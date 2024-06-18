"use strict"

/**
  uiulator - a simple way to display javascript state in html.

  How to use this:

   - Lay out your html as you like.  Mark elements on which you'd
     like to display data with "data-shows".  Mark elements which
     you want to use to set data with "data-controls", etc (see
     below).

   - apply the uiulator something like:
       var my_data = { x: 1, y: 2 }; // or whatever
       var uu = uiulator(my_data, document.querySelectorAll(".uistuffs");
       uu.update();  // refresh the display. (typically call this from an event)

     uiulator can take a list of elements or a single element.

  There are 4 element "markers" which determine how the data are
  controlled or displayed:
    - data-shows=<member>    - show the named member of the scope
    - data-expands=<member>  - duplicate for each item in the member
    - data-shows-key         - within an expansion, show key instead of value
    - data-controls=<member> - set the named member from the value or content of the element
    - data-scope=<member>    - set the scope for all 

  In all cases, if the member is unspecified (empty string), the
  current scope is used.  "Current scope", in this context, is
  either the "dataSource" passed to the uiulator, or whatever sub
  object within was selected by data-scope, or the current item
  in a data-expands.

  So, for example, say you have some data:
    const someData = {
        luckyNumbers: [ 7, 8, 23 ],
        opinions: {
            bob: [ "Green is the best color", "Pizza is too greasy" ],
            mary: [ "Pizza is great" ],
            schmedly: [ ],
        },
    };

  And some html for displaying those data:
    ...
    <div id="numbershower">
      I consider these numbers lucky:
      <span data-expands="luckyNumbers"></span>
    </div>

    <div id="op-ed" data-scope="opinions">
      <div data-expands="">
        <span data-shows-key></span> has <span data-shows="length"> opinions:
        <ul> <li data-expands=""></li> </ul>
      </div>
    </div>

    <div class="numberpicker">
      <label> select your lucky number here:
        <select name="pets" data-controls="currentNumber">
XXX options not dtrt
        </select>
      </label>
    </div>

   ... the page will show:
    - a span displaying each lucky number,
    - a div for each set of opinions, within which there will be a
      span showing whose opinions, how many opinions they have,
      followed by a span for each opinion.
    - finally, a div with a selector for letting the user enter
      which number is their lucky number.
 */

/**
   uiulator(dataSource)
   uiulator(dataSource, elements)
   uiulator(dataSource, elements, options)

   Applies uiular rules to the specified elements, using data from the
   dataSource passed.

   Parameters:
     - dataSource: A javascript variable (typically an array or object, but
                   may be a scalar value) to be displayed on and/or set from
                   the indicated elements.
     - elements:   The set of root elements to which to apply the uiulator.
                   May be sepcified as a single Element or an array of
                   Elements.  If not specified, the global document is used.
                   https://developer.mozilla.org/en-US/docs/Web/API/Element
     - options:    An object with 0 or more of the following:
                   - 'control-on-submit': <boolean>
                     If true, only modify the dataSource when it appears the
                     user has "submitted" the data (typically on a 'change'
                     event).  Otherwise (of false or omitted), data in the
                     dataSource may be modified as soon as any change is
                     detected (eg as the user is typing).
                   - oncontrolchanged: <function (ev, elem, container, var, old)>
                     Causes the specified function to be called after a
                     data-control makes a change to data.  Parameters:
                       - ev: the Event which precipitated the change
                       - elem: the data-control Element which made the change
                       - container: the containing scope of the changed var
                       - var: the name of the variable which was changed
                       - old: the old value of the variable
                   - poll-interval: <numeric microseconds>
                     If specified, a timer will be scheduled to call update()
                     on the specified interval.
                   - 'update-on-change': <boolean>
                     If true, call update() any time a change is detected on
                     an element marked with data-controls.

                   If neither poll-interval nor update-on-change are set,
                   it's up to callers to make sure update() is called
                   as necessary.
   
 */
var uiulator = function(dataSource, elements, options) {

    options ||= { };

    // if no elements were specified, do them all!  This is typically
    // a one-off, so I'm not too worried about performance.  If callers
    // are concerned, then can narrow the scope themselves.
    if(typeof elements === "undefined") {
        elements = [ document ];
    }

    // support single elements as well as array:
    if(typeof elements.forEach === "undefined") {
        // .. err.. and it turns out an htmlCollection isn't like
        // an array.  but let's attempt to support it, even though
        // browsers and js (naturally) will try to thwart us:
        let elst = Object.prototype.toString.call(elements);
        if(/HTMLCollection/.test(elst)) {
            // looks like it's probably an HTML collection:
            elements = Array.prototype.slice.call(elements);
        } else {
            // it's some kind of single object.  create a one
            // element array to hold it so that we can just deal
            // with arrays from here out:
            elements = [ elements ];
        }
    }

    // This is the order in which element markers are applied:
    // "data-scope" (and "data-expands") adjust the scope for
    // the current element (and all child elements) before
    // anything else, and "data-shows" must come last so that
    // it always shows the latest state.
    const controlOrder = [
        "scope", // grr should this then be "scopes"?
        "expands",
        "controls",
        "showsKey", // js renames this one
        "shows",
    ];

    // these are for stashing data in expander elements:
    const origStyles     = Symbol();
    const generatedElems = Symbol();

    // and this is for updaters (or anything else
    // which wants access more directly to the thing
    // being shown)
    const nowShowing = Symbol();

    function parseVarSpec(vs) {
        if(vs === undefined)
            return [ ];

        vs = vs.replace(/[^A-Za-z_0-9.]/g, "");
        if(!vs.length)
            return [ ];

        return vs.split(".");
    }

    function evaluate(data, vs) {
        if(data === undefined || vs === undefined)
            return data;

        for(const varr of vs) {
            if(data[varr] == undefined)
                return undefined;

            data = data[varr];
        }
        return data;
    }

    function rescopeClone(clone, key) {
        // change the id of the clone, or else it inherits
        // the id and we get duplicate ids:
        if(clone.id !== "")
            clone.id = clone.id + "-" + key;

        // ... and do the appropriate key, if we show that:
        if(clone.dataset?.showsKey !== undefined)
            clone.dataset.showsKey = key;

        for(const kid of clone.childNodes) {
            rescopeClone(kid, key);
        }
    }

    function cloneAndExpand(elem, data, key) {
        let newElem = elem.cloneNode(true);
        rescopeClone(newElem, key);

        for(const stel in elem[origStyles]) {
            newElem.style[stel] = elem[origStyles][stel];
        }

        // OK so here's how we'll do it: the new element gets
        // scoped according to the key passed:
        newElem.dataset.scope = key;
        elem.parentElement.insertBefore(newElem, elem);

        // Also, 

        return newElem;
    }

    function setExpanderStyle(elem, styleOverride) {
        if(!elem[origStyles]) {
            elem[origStyles] = { };
        }

        for(const key in styleOverride) {
            elem[origStyles][key] = elem.style[key];
            elem.style[key]       = styleOverride[key];
        }
    }

    function keyForElement(elem) {
        const ds = elem.dataset;
        if(ds) {
            for(const marker of controlOrder) {
                if(ds[marker] !== undefined)
                    return ds[marker];
            }
        }
        return undefined;
    }

    function onControlModified(ev) {
        const elem = ev.target;
        const data = elem[nowShowing];
        const varPath = parseVarSpec(elem.dataset.shows);
        const specificVar = varPath.pop();
        const container = evaluate(data, varPath);
        if(container === undefined) {
            console.warn(
                `Can't set ${varPath}[${specificVar}] because it's undefined`
            );
        } else {
            var oldVal = container[specificVar];
            if(elem.value !== undefined) {
                container[specificVar] = elem.value;
            } else {
                container[specificVar] = elem.innerText;
            }
        }

        if(options['update-on-change']) {
            updateDisplays();
        }

        if(options['oncontrolchanged']) {
            options['oncontrolchanged'](
                ev, elem, container, specificVar, oldVal
            );
        }
    }

    function doShow(elem, val) {
        if(elem.type === "radio") {
            // Radio buttons are special because there's one
            // value being shown/controlled by multiple elements,
            // but each of those elements has a (constant) "value"
            // it sets when selected.  So, it should be selected
            // if the value matches, but the value of the radio
            // button should -not- be changed, since that would
            // just set all the radio button values to the current
            // value.  :D
            elem.checked = val === elem.value;
/*
        } else if(elem.tagName === "OPTION") {
            // OK <option>s are also special.  They need both
            // the value and some kind of content set.  grr.
            elem.textContent = val;
            elem.value = keyForElement(elem);
//            elem.value = val;
 */
        } else {
            // don't change the active element - it's very annoying
            // for users if they are trying to copy and paste or type
            // something in and you change it:
            if(document.activeElement !== elem) {
                if(elem.value === undefined) {
                    // normal div or span or whatever
                    elem.textContent = val;
                } else {
                    // normal inputs:
                    elem.value = val;
                }
            }
        }
    }

    // given an integer, returns an iterable object
    // with the values [0..integer] (inclusive)
    function iterableInteger(integer) {
      return function*() {
        let index = 0;
        while(index < integer) {
          yield index++;
        }
      }();
    }

    // update functions, by name:
    const upFunc = {
        scope: function(elem, data, vs) {
            // data = evaluate data[vs]; continue on elem with new data
            return [ elem, evaluate(data, parseVarSpec(vs)) ];
        },
        expands: function(elem, data, vs) {
            // - hide the element since we just want to show the clones:
            if(!elem[origStyles]) {
                setExpanderStyle(elem, { display: 'none' });
            }

            // - rescope data by vs;
            data = evaluate(data, parseVarSpec(vs));

            const oldGenEls = elem[generatedElems] ?? { };
            const newGenEls = { };
            if(data) {
                if(typeof(data) === 'string') {
                    // errf.. if it's a string, we don't want it to
                    // expand for each char:
                    data = [ data ];
                }
                    
                if(Number.isInteger(data)) {
                    var keys = iterableInteger(data);
                } else {
                    var keys = Object.keys(data);
                }

                // - for each key of data
                //   - copy elem
                //   - continue on copy of elem, passing key as vs
                const oldExpands = elem.dataset.expands;
                delete elem.dataset.expands;
                for(const key of keys) {
                    if(oldGenEls[key]) {
                        // reuse the old element:
                        newGenEls[key] = oldGenEls[key];
                        delete oldGenEls[key];
                    } else {
                        // no element for this thing yet, so make one:
                        newGenEls[key] = cloneAndExpand(elem, data, key);
                    }
                    updateElements(newGenEls[key], data);

                }
                elem.dataset.expands = oldExpands;

            }
            // remove any orphaned elements (ones for which the
            // data no longer exist) from the DOM:
            for(const key in oldGenEls) {
                oldGenEls[key].remove();
            }
            elem[generatedElems] = newGenEls;

            // callers should consider themselves done with this
            // part of the tree; all other updates will be done
            // on the clones.
            return [ undefined, undefined ];
        },
        showsKey: function(elem, data, vs) {
            doShow(elem, keyForElement(elem));
            return [ elem, data ];
        },
        shows: function(elem, data, vs) {
            elem[nowShowing] = data;
            doShow(elem, evaluate(data, parseVarSpec(vs)));
            return [ elem, data ];
        },
        controls: function(elem, data, vs) {

            // (normal) controllers always show what they control:
            elem.dataset.shows = vs;

            // 2 possible modes:
            //   - 'control-on-submit' means controls only modify
            //     the data when there's a "change" event (i.e. when
            //     the user hit "return" or exeited the input or whatever)
            //   - the default old-style where the event was fired on
            //     any input
            if(options['control-on-submit']) {
                elem.addEventListener('change', onControlModified);
            } else {
                elem.addEventListener('input',  onControlModified);
            }

            // now that the event handlers are installed,
            // we no longer need/want this:
            delete elem.dataset.controls;

            return [ elem, data ];
        },
    }

    // debugging hook so I can select specific elements to break on:
    const breakOn = {
        //secrets: true,
    };

    // updates the element passed, and all its children
    function updateElements(elem, data) {
        const ds = elem.dataset;
        if(ds) {
            for(const updater of controlOrder) {
                if(ds[updater] !== undefined) {
                    if(breakOn[ds[updater]]) {
                        console.log(`give me a break on ${updater} ${ds[updater]}`);
                    }
                    [elem, data] = upFunc[updater](elem, data, ds[updater]);
                }
                if(!elem) break;
            }
        }

        if(elem) {
            for(const kid of elem.childNodes) {
                updateElements(kid, data);
            }
        }
    }

    function updateDisplays() {
        for(const elem of elements) {
            updateElements(elem, dataSource);
        }
    }

    updateDisplays();

    if(options['poll-interval'] !== undefined) {
        window.setInterval(updateDisplays, options['poll-interval']);
    }

    return {
        version: 0.2,
        /**
           update() - call this to sync the data to the display
         */
        update: updateDisplays,
    };

};
