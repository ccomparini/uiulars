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

    var showers = [ ];

    function evaluateMember(containingObject, variable) {
        let val;
        if(typeof containingObject !== 'undefined') {
            val = containingObject[variable];
            if (typeof val === "function") {
                val = val.apply(containingObject);
                // handle promises by making every result a promise
                // which ...  can it call update?
                //Promise.resolve(val).then(function(value) { });
            }
        }
        return val;
    }

    // expands elements with "data-expand", creating one copy of the
    // element for each item in the group specified, and with data-scope
    // set to the corresponding item in the group.
    function expandElements(protoElement, scope) {
        let elems = _expand(protoElement, scope);
        elems.forEach(function(el) { bindDisplay(el, scope); });
    }

    function _expand(protoElement, scope) {
        let dataset = protoElement.dataset || { };
        let expand = dataset.expands;
        let newElements = [ ];

        scope = rescope(protoElement, scope);

        if(typeof(expand) !== 'undefined') {
            // We've got a "data-expand=x", which means we want to
            // make a new element for each thing in collection x
            let parsedFrom = parseDisplayDef(protoElement, expand, scope);

            // at this point, we are going to expand this thing, and we
            // don't want its clones inheriting "expand" (which could
            // lead to infinite expansion), so kill the data-expand:
            delete protoElement.dataset.expands;

            // for each thing in the containingObject[variable],
            // we need to make a copy of the prototype html element
            // to represent that thing:
            let objs = parsedFrom.containingObject;
            if(parsedFrom.variable)
                objs = evaluateMember(objs, parsedFrom.variable);

            for (const key in objs) {
                
                let newElem = protoElement.cloneNode(true);
                newElements.push(newElem);

                // change the id of the clone, or else it inherits
                // the id and we get duplicate ids:
                if(newElem.id !== "")
                    newElem.id = newElem.id + "-" + key;

                // if a particular scope has been given for the
                // data-expand, use it:
                if(expand)
                    newElem.dataset.scope = expand + "." + key;
                else
                    newElem.dataset.scope = key;

                protoElement.parentElement.insertBefore(newElem, protoElement);
            }

            // finally, hide the element which we expanded (since it's
            // the prototype and doesn't make sense to keep showing)
            protoElement.style.display = 'none';
        }

        let kids = protoElement.children;
        if(!kids) return;
        for (let kid = kids[0]; !!kid ; kid = kid.nextSibling) {
            _expand(kid, scope);
        }

        return newElements;
    }

    // Note:  elem is basically jammed back into the result
    // (and not really used here) because doing so is convenient
    // for callers.
    function parseDisplayDef(elem, variable, scope) {
        variable.replace(/[^A-Za-z_0-9.]/g, "");
        let parts = variable.split(".");

        let obj = scope;

        for(let pi = 0; pi < parts.length - 1; pi++) {
            if(!obj) {
                console.log("no such variable '" + parts[pi] + "' in '" + variable + "'");
                break;
            }
            obj = obj[parts[pi]];
        }


        return {
            element: elem,
            containingObject: obj,
            variable: parts[parts.length - 1],
        };
    }

    function rescope(elem, existingScope) {
        if(elem.dataset && (typeof(elem.dataset.scope) !== "undefined")) {
            let ns = parseDisplayDef(elem, elem.dataset.scope, existingScope);
            return ns.containingObject[ns.variable];
        } else {
            return existingScope;
        }
    }

    function bindDisplay(display, scope) {
        if(!display.dataset) return;

        scope = rescope(display, scope);

        // ok let's say display elements have:
        //  - (optionally) the element which sets the thing
        //    in which case, in here, we set onChange or whatever
        //    so like <blah data-controls="debug">. if set, this
        //    would normally also be what it shows.
        //  - (optionally) the element on which to display the thing
        //    so like <blah data-shows="player.score">
        let shows = display.dataset.shows || display.dataset.controls;
        let ctrl  = display.dataset.controls;
        if(shows) {
            showers.push(parseDisplayDef(display, shows, scope));
            delete display.dataset.shows; // so we don't bind it again
        }

        if(ctrl) {
            let def = parseDisplayDef(display, ctrl, scope);
            showers.push(def);
            let el = def.element;
            el.contenteditable = true; // doesn't seem to work; have to set in html?
            el.addEventListener('change', function(ev) { updateControl(def) });
            el.addEventListener('input',  function(ev) { updateControl(def) });
            delete display.dataset.controls;
        }

        // controllers can be compound. i.e. we may
        // pass in an outer element with inner elements
        // displaying various things.  So recurse sub
        // elements.
        let kids = display.children;
        for (let ci = 0; ci < kids.length; ci++) {
            bindDisplay(kids[ci], scope);
        }
    }

    function updateControl(def) {
        let el = def.element;
        if(typeof(el.value) !== undefined) {
            def.containingObject[def.variable] = el.value;
        } else {
            def.containingObject[def.variable] = el.innerText;
        }
    }
 */

    /**
      Call this periodically to update displays.
     */
 /*
    function updateDisplays() {
        for (let di = showers.length - 1; di >= 0; di--) {
            let shower = showers[di];
            let val = evaluateMember(shower.containingObject, shower.variable);
            if(document.activeElement !== shower.element) {
                shower.element.textContent = val;
                shower.element.value = val; // for inputs
            }
        }
    }

    // here's where we apply data to the target stuffles:
    elements.forEach(function(el) { expandElements(el, dataSource); });
    elements.forEach(function(el) { bindDisplay   (el, dataSource); });

    updateDisplays();
 */

/*
TODO:
   - controls
   x hide the expanders
   - expand n times if it's not a collection but is numeric?
   - kill '*' or use it.
   - fix ids in clones somehow so they don't collide
   - add default update intervals
   - option for tables:  cloning headers makes td?
     - test tables
   - maybe change the data-shows etc to like data-uiulator-shows
 */

    // these are for stashing data in expander elements:
    const origStyles     = Symbol();
    const generatedElems = Symbol();

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
        updateElements(newElem, data);

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

    // this is separate from upFunc because the order matters
    const updaters = [
        "scope", // grr should this then be "scopes"?
        "expands",
        "shows",
        "controls",
    ];

    const upFunc = {
        scope: function(elem, data, vs) {
            // data = evaluate data[vs]; continue on elem with new data
            return [ elem, evaluate(data, vs) ];
        },
        expands: function(elem, data, vs) {
            // - hide the element since we just want to show the clones:
            if(!elem[origStyles]) {
                setExpanderStyle(elem, { display: 'none' });
            }

            // - delete previously generated elements
            let genEls = elem[generatedElems];
            if(genEls) {
                for(const el of genEls) {
                    el.remove();
                }
            }
            genEls = [ ];

            // - rescope data by vs;
            data = evaluate(data, vs);

            // - for each key of data
            //   - copy elem
            //   - continue on copy of elem, passing key as vs
            if(data) {
                const oldExpands = elem.dataset.expands;
                delete elem.dataset.expands;
                for(const key in data) {
                    genEls.push(cloneAndExpand(elem, data, key));
                }
                elem.dataset.expands = oldExpands;
            }

            elem[generatedElems] = genEls;

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
                const val = evaluate(data, vs);
                elem.textContent = val;
                elem.value = val; // for inputs
            }
            
            return [ elem, data ];
        },
        controls: function(elem, data, vs) {
            // - if no control function, install one.
            // - evaluate data[vs] and show it in elem
            // (POSSIBLY this one should be implemented by just installing
            // the control function and changing data-controls to data-shows...)
            return [ elem, data ];
        },
    }

    // updates the element passed, and all its children
    function updateElements(elem, data) {
        const ds = elem.dataset;
        if(ds) {
            for(const updater of updaters) {
                if(ds[updater] !== undefined) {
                    [elem, data] = upFunc[updater](
                        elem, data, parseVarSpec(ds[updater])
                    );
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
