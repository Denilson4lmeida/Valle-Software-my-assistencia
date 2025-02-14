document.addEventListener("DOMContentLoaded", function () {
    const linkInicio = document.querySelector("a[href='index.html']");

    if (linkInicio) {
        linkInicio.addEventListener("click", function (event) {
            if (window.location.href.includes("index.html") || window.location.pathname === "/") {
                event.preventDefault();
                alert("Já está na página!");
            }
        });
    }
});
