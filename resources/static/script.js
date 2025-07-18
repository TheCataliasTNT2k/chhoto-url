// SPDX-FileCopyrightText: 2023 Sayantan Santra <sayantan.santra689@gmail.com>
// SPDX-License-Identifier: MIT

var VERSION = null;
var SITE_URL = "-";
var CONFIG = null;
var SUBDIR = null;

const prepSubdir = (link) => {
    if (!SUBDIR) {
        let thisPage = new URL(window.location.href);
        SUBDIR = thisPage.pathname.replace(/\/admin\/manage\/$/, "/");
    }
    return (SUBDIR + link).replace('//', '/');
}

const getConfig = async () => {
    if (!CONFIG) {
        CONFIG = await fetch(prepSubdir("/api/getconfig"))
                    .then(res => res.json());
        if (CONFIG.site_url == null) {
            SITE_URL = window.location.host.replace(/\/$/, '');
        }
        else {
            SITE_URL = CONFIG.site_url.replace(/\/$/, '').replace(/^"/, '').replace(/"$/, '');
        }
        VERSION = CONFIG.version;
    }
}

const showVersion = async () => {
    await getConfig();
    link = document.getElementById("version-number");
    link.innerText = "v" + VERSION;
    link.href = "https://github.com/SinTan1729/chhoto-url/releases/tag/" + VERSION;
    link.hidden = false;
}

const getLogin = async () => {
    document.getElementById("container").style.filter = "blur(2px)";
    document.getElementById("login-dialog").showModal();
    document.getElementById("password").focus();
}

const refreshData = async () => {
    let res = await fetch(prepSubdir("/api/all"));
    if (!res.ok) {
        let errorMsg = await res.text();
        document.getElementById("url-table").innerHTML = '';
        console.log(errorMsg);
        if (errorMsg.startsWith("Using public mode.")) {
            document.getElementById("admin-button").hidden = false;
            let loading_text = document.getElementById("loading-text");
            loading_text.innerHTML = "Using public mode.";
            let expiry = parseInt(errorMsg.split(" ").pop());
            if (expiry > 0) {
                loading_text.innerHTML += " Unless chosen a shorter expiry time, submitted links will automatically expire ";
                time = new Date();
                time.setSeconds(time.getSeconds() + expiry);
                loading_text.innerHTML += formatRelativeTime(time) + ".";
            }
            showVersion();
        } else {
            getLogin();
        }
    } else {
        let data = await res.json();
        displayData(data.reverse());
    }
}

const displayData = async (data) => {
    await getConfig();
    await showVersion();
    admin_button = document.getElementById("admin-button");
    admin_button.innerText = "logout";
    admin_button.href = "javascript:logOut()";
    admin_button.hidden = false;

    if (CONFIG.allow_capital_letters) {
        let input_box = document.getElementById("shortUrl");
        input_box.pattern = "[A-Za-z0-9\-_]+";
        input_box.title = "Only A-Z, a-z, 0-9, - and _ are allowed";
        input_box.placeholder = "Only A-Z, a-z, 0-9, - and _ are allowed";
    }

    table_box = document.getElementById("table-box");
    loading_text = document.getElementById("loading-text");
    const table = document.getElementById("url-table");

    if (data.length == 0) {
        table_box.hidden = true;
        loading_text.innerHTML = "No active links.";
        loading_text.hidden = false;
    }
    else {
        loading_text.hidden = true;
        if (!window.isSecureContext) {
            const shortUrlHeader = document.getElementById("short-url-header");
            shortUrlHeader.innerHTML = "Short URL<br>(right click and copy)";
        }
        table_box.hidden = false;
        table.innerHTML = '';
        data.forEach(tr => table.appendChild(TR(tr)));
        setTimeout(refreshExpiryTimes, 1000);
    }
}

const showAlert = async (text, col) => {
    document.getElementById("alert-box")?.remove();
    const controls = document.getElementById("controls");
    const alertBox = document.createElement("p");
    alertBox.id = "alert-box";
    alertBox.style.color = col;
    alertBox.innerHTML = text;
    controls.appendChild(alertBox);
}

const refreshExpiryTimes = async () =>  {
    const tds = document.getElementsByClassName("tooltip");
    for (let i = 0; i < tds.length; i++) {
        let td = tds[i];
        let expiryTimeParsed = new Date(td.getAttribute("data-time") * 1000);
        let relativeTime = formatRelativeTime(expiryTimeParsed);
        if (relativeTime == "expired") {
            td.style.color = "light-dark(red, #ff1a1a)";
        }
        let div = td.firstChild;
        div.innerHTML = div.innerHTML.replace(div.innerText, relativeTime);
    }
    if (tds.length > 0) {
        setTimeout(refreshExpiryTimes, 1000);
    }
}

const formatRelativeTime = (timestamp) => {
    const now = new Date();
    // in miliseconds
    var units = {
        year  : 31536000000,
        month : 2592000000,
        day   : 86400000,
        hour  : 3600000,
        minute: 60000,
        second: 1000,
    };

    var diff = (timestamp) - now;
    if (diff <= 0) {
        return "expired";
    }
    var rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
      // "Math.abs" accounts for both "past" & "future" scenarios
    for (var u in units) {
        if (Math.abs(diff) > units[u] || u == 'second') {
            return rtf.format(Math.round(diff/units[u]), u);
        }
    }
}

const TD = (s, u) => {
    const td = document.createElement("td");
    const div = document.createElement("div");
    div.innerHTML = s;
    td.appendChild(div);
    td.setAttribute("label", u);
    return td;
}

const TR = (row) => {
    const tr = document.createElement("tr");
    const longTD = TD(A_LONG(row["longlink"]), "Long URL");
    var shortTD = null;
    var isSafari = /Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor);
    // For now, we disable copying on WebKit due to a possible bug. Manual copying is enabled instead.
    // Take a look at https://github.com/SinTan1729/chhoto-url/issues/36
    if (window.isSecureContext && !(isSafari)) {
        shortTD = TD(A_SHORT(row["shortlink"], SITE_URL), "Short URL");
    }
    else {
        shortTD = TD(A_SHORT_INSECURE(row["shortlink"], SITE_URL), "Short URL");
    }
    let hitsTD = TD(row["hits"]);
    hitsTD.setAttribute("label", "Hits");
    hitsTD.setAttribute("name", "hitsColumn");
    
    let expiryTime = row["expiry_time"];
    let expiryHTML = "-";
    if (expiryTime > 0) {
        let expiryTimeParsed = new Date(expiryTime * 1000);
        let relativeExpiryTime = formatRelativeTime(expiryTimeParsed);
        let accurateExpiryTime = expiryTimeParsed.toLocaleString();
        expiryHTML = relativeExpiryTime + '<span class="tooltiptext">' + accurateExpiryTime + '</span>';
    }

    let expiryTD = TD(expiryHTML);
    if (expiryTime > 0) {
        expiryTD.width = "160px";
        expiryTD.setAttribute("data-time", expiryTime);
        expiryTD.classList.add("tooltip");
    }
    expiryTD.setAttribute("label", "Expiry");
    expiryTD.setAttribute("name", "expiryColumn");

    const btn = deleteButton(row["shortlink"]);

    tr.appendChild(shortTD);
    tr.appendChild(longTD);
    tr.appendChild(hitsTD);
    tr.appendChild(expiryTD);
    tr.appendChild(btn);

    return tr;
}

const copyShortUrl = async (link) => {
    await getConfig();
    try {
        navigator.clipboard.writeText(`${SITE_URL}/${link}`);
        showAlert(`Short URL <a href=${SITE_URL}/${link}>${SITE_URL}/${link}</a> was copied to clipboard!`, "light-dark(green, #72ff72)");
    } catch (e) {
        console.log(e);
        showAlert(`Could not copy short URL to clipboard, please do it manually: <a href=${SITE_URL}/${link}>${SITE_URL}/${link}</a>`, "light-dark(red, #ff1a1a)");
    }

}

const addProtocol = (input) => {
    var url = input.value.trim();
    if (url != "" && !~url.indexOf("://") && !~url.indexOf("magnet:")) {
        url = "https://" + url;
    }
    input.value = url;
    return input;
}

const A_LONG = (s) => `<a href='${s}'>${s}</a>`;
const A_SHORT = (s, t) => `<a href="javascript:copyShortUrl('${s}');">${s}</a>`;
const A_SHORT_INSECURE = (s, t) => `<a href="${t}/${s}">${s}</a>`;

const deleteButton = (shortUrl) => {
    const td = document.createElement("td");
    const div = document.createElement("div");
    const btn = document.createElement("button");

    btn.innerHTML = "&times;";

    btn.onclick = e => {
        e.preventDefault();
        if (confirm("Do you want to delete the entry " + shortUrl + "?")) {
            document.getElementById("alert-box")?.remove();
            showAlert("&nbsp;", "black");
            fetch(prepSubdir(`/api/del/${shortUrl}`), {
                method: "DELETE"
            }).then(res => {
                if (res.ok) {
                    console.log("Deleted " + shortUrl);
                } else {
                    console.log("Unable to delete " + shortUrl);
                }
                refreshData();
            });
        }
    };
    td.setAttribute("name", "deleteBtn");
    td.setAttribute("label", "Delete");
    div.appendChild(btn);
    td.appendChild(div);
    return td;
}

const submitForm = () => {
    const form = document.forms.namedItem("new-url-form");
    const data = {
        "longlink": form.elements["longUrl"].value,
        "shortlink": form.elements["shortUrl"].value,
        "expiry_delay": parseInt(form.elements["expiryDelay"].value),
    };

    const url = prepSubdir("/api/new");
    let ok = false;

    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    })
        .then(res => {
            ok = res.ok;
            return res.text();
        })
        .then(text => {
            if (!ok) {
                showAlert(text, "light-dark(red, #ff1a1a)");
            }
            else {
                copyShortUrl(text);
                longUrl.value = "";
                shortUrl.value = "";
                expiryDelay.value = 0;
                refreshData();
            }
        })
}

const submitLogin = () => {
    const password = document.getElementById("password");
    fetch(prepSubdir("/api/login"), {
        method: "POST",
        body: password.value
    }).then(res => {
        if (res.ok) {
            document.getElementById("container").style.filter = "blur(0px)"
            document.getElementById("login-dialog").close();
            password.value = '';
            document.getElementById("wrong-pass").hidden = true;
            refreshData();
        } else {
            document.getElementById("wrong-pass").hidden = false;
            password.focus();
        }
    })
}

const logOut = async () => {
    let reply = await fetch(prepSubdir("/api/logout"), {method: "DELETE"}).then(res => res.text());
    console.log(reply);
    document.getElementById("table-box").hidden = true;
    document.getElementById("loading-text").hidden = false;
    admin_button = document.getElementById("admin-button");
    admin_button.innerText = "login";
    admin_button.href = "javascript:getLogin()";
    admin_button.hidden = false;
    refreshData();
}

(async () => {
    await refreshData();

    const form = document.forms.namedItem("new-url-form");
    form.onsubmit = e => {
        e.preventDefault();
        submitForm();
    }

    const login_form = document.forms.namedItem("login-form");
    login_form.onsubmit = e => {
        e.preventDefault();
        submitLogin();
    }
})()
