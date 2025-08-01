import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "./tests.ts";

function init() {
    createRoot(document.getElementById('root')!).render(<StrictMode><MyComponent/></StrictMode>);
}

function MyComponent() {
    function doClick() {
        alert("Hello World!");
    }

    const style = {
        background: "yellow",
        display: "inline-block",
        cursor: "pointer"
    }

    return  <div onClick={doClick} style={style}>Click Me!</div>
}

init();
