"use strict"

/**
  uiulator - a simple way to display javascript state in html.

  How to use this:

   - Lay out your html as you like.  Mark elements on which you'd
     like to display data with "data-shows".  Mark elements which
     you want to use to set data with "data-controls".

   - apply the uiulator something like:
       var my_data = { x: 1, y: 2 }; // or whatever
       var uu = uiulator(my_data, document.querySelectorAll(".uistuffs");
       uu.update();  // refresh the display. (typically call this from an event)

     uiulator can take a list of elements or a single element.

  Element markers:
    - data-shows:  
    - data-expand:  
    - data-controls:  
 */

/**
   uiulator(dataSource, elements) - 
 */
var uiulator = function(dataSource, elements) {

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

/*
TODO:
   x controls
   - checkbox controls grrr
   x hide the expanders
   - expand n times if it's not a collection but is numeric?
   - kill '*' or use it.
   - fix ids in clones somehow so they don't collide
   - add default update intervals
     - OR see if we can use Object.watch??
       https://stackoverflow.com/questions/3051114/value-of-variable-has-changed-or-not
       ^^^ but I can't find that on MDN and it really doesn't seem to exist.
       MAYBE have an option to install setters which fire off updates?
   - option for tables:  cloning headers makes td?
     - test tables
   - maybe change the data-shows etc to like data-uiulator-shows

   - NOTE that on branch allow-container-changes there was a more
     sophisticated expansion (which didn't work right for subs,
     but..) which didn't kill all the elements each time, so it's
     both (probably) more efficient but also means that if you're
     typing in a box to change a value you don't get cut off.  hmm.
     brute force solution would be to pause the whole update if
     an element which would be deleted has focus...
     ^^ ACTUALLY don't worry;  we -can- use the code from the other
     branch since cloning happens once per key so keys are unique
     so just use the keys to know if/when things should actaully
     change.
 */

    // these are for stashing data in expander elements:
    const origStyles     = Symbol();
    const generatedElems = Symbol();

    // and this is for updaters:
    const nowShowing = Symbol();

    function parseVarSpec(vs) {
        if(vs === undefined)
            return [ ];

// XXX consider the '*' - in or out?
        vs = vs.replace(/[^A-Za-z_0-9*.]/g, "");
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

    function cloneAndExpand(elem, data, vs) {
        let newElem = elem.cloneNode(true);

        for(const stel in elem[origStyles]) {
            newElem.style[stel] = elem[origStyles][stel];
        }

        // OK so here's how we'll do it: the new element gets
        // scoped according to the vs passed:
        newElem.dataset.scope = vs;
        elem.parentElement.insertBefore(newElem, elem);

// TODO change all the sub IDs in the new element tree so they don't collide
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
            if(typeof(elem.value) !== undefined) {
                container[specificVar] = elem.value;
            } else {
                container[specificVar] = elem.innerText;
            }
        }
    }


    // this is separate from upFunc because the order matters
    const updaters = [
        "scope", // grr should this then be "scopes"?
        "expands",
        "controls",
        "shows",
    ];

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

                // - for each key of data
                //   - copy elem
                //   - continue on copy of elem, passing key as vs
                const oldExpands = elem.dataset.expands;
                delete elem.dataset.expands;
                for(const key in data) {
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
        shows: function(elem, data, vs) {
            // don't change the active element - it's very annoying
            // for users if they are trying to copy and paste or type
            // something in and you change it:
            if(document.activeElement !== elem) {
                elem[nowShowing] = data;
                const val = evaluate(data, parseVarSpec(vs));
                if(elem.value === undefined) {
                    // normal div or span or whatever
                    elem.textContent = val;
                } else {
                    elem.value = val; // inputs, dropdowns etc
                }
            }
            
            return [ elem, data ];
        },
        controls: function(elem, data, vs) {

            // controllers always show what they control:
            elem.dataset.shows = vs;

            elem.addEventListener('change', onControlModified);
            elem.addEventListener('input',  onControlModified);

            // now that the event handlers are installed,
            // we no longer need/want this:
            delete elem.dataset.controls;

            return [ elem, data ];
        },
    }

    // debugging hook so I can select specific elements to break on:
    const breakOn = {
        secrets: true,
    };

    // updates the element passed, and all its children
    function updateElements(elem, data) {
        const ds = elem.dataset;
        if(ds) {
            for(const updater of updaters) {
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

    return {
        version: 0.1,
        /**
           update() - call this to sync the data to the display
         */
        update: updateDisplays,
    };

};
