uiulator - a simple way to display javascript data in html (in browser).

Here's [a relatively simple self-referential example](https://fbmstudios.net/uiulars/example-1.html) of how you can use this, and
here's [a more complicated dynamic example](https://fbmstudios.net/uiulars/example-3.html).
More example links below.

How to use this:

Lay out your html as you like.  Mark elements on which you'd
like to display data with "data-shows".  Mark elements which
you want to use to set data with "data-controls", etc. - the
possible "markers" are:

- data-shows=&lt;member>    - show the named member of the scope
- data-expands=&lt;member>  - duplicate for each item in the member
- data-controls=&lt;member> - set the named member from the value or content of the element
- data-scope=&lt;member>    - set the scope for all

Then, in you js (someplace), apply the uiulator something like:

    const myData = { x: 1, y: 2 };
    const elements = document.querySelectorAll(".where-to-display");
    const options = { /* see below */ };
    uiulator(myData, elements, options);

"elements" may be a single element as returned by getElementbyId(),
or a set of elements as an array or as returned by querySelectorAll(),
or undefined to apply to all elements in the page (which is usually
less efficient).

"options" is an optional object with or or more of:

- 'control-on-submit': &lt;boolean>
If true, only modify the dataSource when it appears the
user has "submitted" the data (typically on a 'change'
event).  Otherwise (of false or omitted), data in the
dataSource may be modified as soon as any change is
detected (eg as the user is typing).

- oncontrolchanged: &lt;function (ev, elem, container, var, old)>
Causes the specified function to be called after a
data-control makes a change to data.  Parameters:
    - ev: the Event which precipitated the change
    - elem: the data-control Element which made the change
    - container: the containing scope of the changed var
    - var: the name of the variable which was changed
    - old: the old value of the variable

- poll-interval: &lt;numeric microseconds>
If specified, a timer will be scheduled to call update()
on the specified interval.
- 'update-on-change': &lt;boolean>
If true, call update() any time a change is detected on
an element marked with data-controls.

There are 4 element "markers" which determine how the data are controlled or displayed:
- data-shows=&lt;member>    - show the named member of the scope
- data-expands=&lt;member>  - duplicate for each item in the member
- data-controls=&lt;member> - set the named member from the value or content of the element
- data-scope=&lt;member>    - set the scope for all



Other examples are here:
- (https://fbmstudios.net/uiulars/example-0.html)
- (https://fbmstudios.net/uiulars/example-1.html)
- (https://fbmstudios.net/uiulars/example-2.html)

... if I were smart I'd put those in fiddles or something.  Maybe later.
