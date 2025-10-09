(function() {
"use strict";

const icons = {
    replace_preview: '🖼️',
    open_url: '🌐',
    add_trigger_words: '💡',
    use_preview_prompt: '🏷️',
    rename_model: '✏️',
    remove_model: '❌',
};

let replace_preview_text;

function stopEvent(e) {
    // stop parent event
    e.stopPropagation();
    e.preventDefault();
}

function ch_gradio_version() {
    let foot = gradioApp().getElementById("footer");
    if (!foot) {
        return null;
    }

    let versions = foot.querySelector(".versions");
    if (!versions) {
        return null;
    }

    let version = versions.textContent.match(/gradio: +([\d.]+)/i)[1];

    return version || "unknown";
}


/*
 * Functions for scan for duplicates elements.
 */

let ch_path_el = null;
window.display_ch_path = function(_, path) {
    if (!ch_path_el) {
        ch_path_el = document.createElement("div");
        ch_path_el.id = "ch_path_el";
        document.body.appendChild(ch_path_el);
    }

    ch_path_el.textContent = path;
    ch_path_el.style.display = "block";
};

window.move_ch_path = function(e) {
    ch_path_el.style.top = `calc(${e.clientY}px - 2em)`;
    ch_path_el.style.left = `calc(${e.clientX}px + 2em)`;
};

window.hide_ch_path = function(_) {
    ch_path_el.style.display = "none";
};


// send msg to python side by filling a hidden text box
// then will click a button to trigger an action
// msg is an object, not a string, will be stringify in this function
function send_ch_py_msg(msg) {
    console.log("run send_ch_py_msg");
    let js_msg_txtbox = gradioApp().querySelector("#ch_js_msg_txtbox textarea");
    if (js_msg_txtbox && msg) {
        // fill to msg box
        js_msg_txtbox.value = JSON.stringify(msg);
        js_msg_txtbox.dispatchEvent(new Event("input"));
    }

}


// get msg from python side from a hidden textbox
// it will try once in every sencond, until it reach the max try times
const get_new_ch_py_msg = (max_count = 5) => new Promise((resolve, reject) => {
    console.log("run get_new_ch_py_msg");

    let count = 0;
    let new_msg = "";
    let find_msg = false;
    const interval = setInterval(() => {
        const py_msg_txtbox = gradioApp().querySelector("#ch_py_msg_txtbox textarea");
        count++;

        if (py_msg_txtbox && py_msg_txtbox.value) {
            console.log("find py_msg_txtbox");
            console.log("py_msg_txtbox value: ", py_msg_txtbox.value);

            new_msg = py_msg_txtbox.value;
            if (new_msg != "") {
                find_msg = true;
            }
        }

        if (find_msg) {
            //clear msg in both sides
            py_msg_txtbox.value = "";
            py_msg_txtbox.dispatchEvent(new Event("input"));

            resolve(new_msg);
            clearInterval(interval);
        } else if (count > max_count) {
            //clear msg in both sides
            py_msg_txtbox.value = "";
            py_msg_txtbox.dispatchEvent(new Event("input"));

            reject('');
            clearInterval(interval);
        }
    }, 1000);
});


function getActiveTabType() {
    const currentTab = get_uiCurrentTabContent();
    switch (currentTab.id) {
        case "tab_txt2img":
            return "txt2img";
        case "tab_img2img":
            return "img2img";
    }
    return null;
}


function getExtraTabs(prefix) {
    return gradioApp().getElementById(prefix + "_extra_tabs");
}


function getActivePrompt() {
    const currentTab = get_uiCurrentTabContent();
    switch (currentTab.id) {
        case "tab_txt2img":
            return currentTab.querySelector("#txt2img_prompt textarea");
        case "tab_img2img":
            return currentTab.querySelector("#img2img_prompt textarea");
    }
    return null;
}


function getActiveNegativePrompt() {
    const currentTab = get_uiCurrentTabContent();
    switch (currentTab.id) {
        case "tab_txt2img":
            return currentTab.querySelector("#txt2img_neg_prompt textarea");
        case "tab_img2img":
            return currentTab.querySelector("#img2img_neg_prompt textarea");
    }
    return null;
}


//button's click function
window.open_model_url = async function(e, model_type, search_term) {
    console.log("start open_model_url");

    // stop parent event
    stopEvent(e);

    //get hidden components of extension
    let js_open_url_btn = gradioApp().getElementById("ch_js_open_url_btn");
    if (!js_open_url_btn) {
        console.log("Failed to find js_open_url_btn");
        return;
    }

    //msg to python side
    const msg = {
        action: "open_url",
        model_type: model_type,
        search_term: search_term,
        prompt: "",
        neg_prompt: "",
    };

    // fill to msg box
    send_ch_py_msg(msg);

    //click hidden button
    js_open_url_btn.click();

    //check response msg from python
    let new_py_msg = await get_new_ch_py_msg();
    console.log("new_py_msg: ", new_py_msg);

    //check msg
    if (new_py_msg) {
        let py_msg_json = JSON.parse(new_py_msg);
        //check for url
        if (py_msg_json && py_msg_json.content) {
            if (py_msg_json.content.url) {
                window.open(py_msg_json.content.url, "_blank");
            }
        }
    }

    console.log("end open_model_url");
};


window.add_trigger_words = function(e, model_type, search_term) {
    console.log("start add_trigger_words");

    // stop parent event
    stopEvent(e);

    //get hidden components of extension
    let js_add_trigger_words_btn = gradioApp().getElementById("ch_js_add_trigger_words_btn");
    if (!js_add_trigger_words_btn) {
        return;
    }

    // get active prompt
    const act_prompt = getActivePrompt();

    //msg to python side
    const msg = {
        action: "add_trigger_words",
        model_type: model_type,
        search_term: search_term,
        prompt: act_prompt.value,
        neg_prompt: "",
    };

    // fill to msg box
    send_ch_py_msg(msg);

    //click hidden button
    js_add_trigger_words_btn.click();

    console.log("end add_trigger_words");
};


window.use_preview_prompt = function(e, model_type, search_term) {
    console.log("start use_preview_prompt");

    // stop parent event
    stopEvent(e);

    //get hidden components of extension
    const js_use_preview_prompt_btn = gradioApp().getElementById("ch_js_use_preview_prompt_btn");
    if (!js_use_preview_prompt_btn) {
        return;
    }

    // get active prompts
    const act_prompt = getActivePrompt();
    const neg_prompt = getActiveNegativePrompt();

    //msg to python side
    const msg = {
        action: "use_preview_prompt",
        model_type: model_type,
        search_term: search_term,
        prompt: act_prompt.value,
        neg_prompt: neg_prompt.value,
    };

    // fill to msg box
    send_ch_py_msg(msg);

    //click hidden button
    js_use_preview_prompt_btn.click();

    console.log("end use_preview_prompt");
};


window.remove_dup_card = async function(e, model_type, search_term) {
    e.stopPropagation();
    e.preventDefault();

    let el = e.currentTarget;

    let success = await remove_card(e, model_type, search_term);

    if (success === true) {
        let parent = el.parentElement;

        let sha256 = search_term.split(" ").pop().toUpperCase();
        let row_id = `ch_${sha256}`;
        let cards_id = `${row_id}_cards`;

        let cards = document.getElementById(cards_id);

        cards.removeChild(parent);

        if (cards.children.length < 2) {
            let row = document.getElementById(row_id);
            row.parentElement.removeChild(row);
        }
    }
};


window.remove_card = async function(e, model_type, search_term) {
    console.log("start remove_card");

    // stop parent event
    stopEvent(e);

    let status = false;

    //get hidden components of extension
    let js_remove_card_btn = gradioApp().getElementById("ch_js_remove_card_btn");
    if (!js_remove_card_btn) {
        return status;
    }

    // must confirm before removing
    let rm_confirm = "\nConfirm to remove this model and all related files. This process is irreversible.";
    if (!confirm(rm_confirm)) {
        return status;
    }

    //msg to python side
    const msg = {
        action: "remove_card",
        model_type: model_type,
        search_term: search_term,
    };

    // fill to msg box
    send_ch_py_msg(msg);

    //click hidden button
    js_remove_card_btn.click();

    //check response msg from python
    let new_py_msg = "";
    try {
        new_py_msg = await get_new_ch_py_msg();
    } catch (error) {
        console.log(error);
        new_py_msg = error;
    }

    console.log("new_py_msg:");
    console.log(new_py_msg);

    //check msg
    let result = "Done";
    //check msg
    if (new_py_msg) {
        result = new_py_msg;
    }

    if (result == "Done") {
        status = true;
        refresh_cards_list(model_type);
    }

    console.log("end remove_card");

    return status;
};


window.rename_card = async function(e, model_type, search_term, model_name) {
    console.log("start rename_card");

    // stop parent event
    stopEvent(e);

    //get hidden components of extension
    let js_rename_card_btn = gradioApp().getElementById("ch_js_rename_card_btn");
    if (!js_rename_card_btn) {
        return;
    }

    // must confirm before removing
    let rename_prompt = "\nRename this model to:";
    let new_name = prompt(rename_prompt, model_name);
    if (!new_name) {
        return;
    }

    //msg to python side
    const msg = {
        action: "rename_card",
        model_type: model_type,
        search_term: search_term,
        new_name: new_name,
    };

    // fill to msg box
    send_ch_py_msg(msg);

    //click hidden button
    js_rename_card_btn.click();

    //check response msg from python
    let new_py_msg = "";
    try {
        new_py_msg = await get_new_ch_py_msg();
    } catch (error) {
        console.log(error);
        new_py_msg = error;
    }

    console.log("new_py_msg:");
    console.log(new_py_msg);

    //check msg
    let result = "Done";
    //check msg
    if (new_py_msg) {
        result = new_py_msg;
    }

    if (result == "Done") {
        refresh_cards_list(model_type);
    }

    console.log("end rename_card");
};


window.replace_preview = function(e, page, type, name) {
    // stop parent event
    stopEvent(e);

    // we have to create a whole hidden editor window to access preview replace functionality
    extraNetworksEditUserMetadata(e, page, type, name);

    // the editor window takes quite some time to populate
    waitForEditor(page, type, name).then(editor => {
        // Gather the buttons we need to both replace the preview and close the editor
        let cancel_button = editor.querySelector('.edit-user-metadata-buttons button:first-of-type');
        let replace_preview_button = editor.querySelector('.edit-user-metadata-buttons button:nth-of-type(2)');

        replace_preview_button.click();
        cancel_button.click();
    });
};


// download model's new version into SD at python side
window.ch_dl_model_new_version = function(e, model_path, version_id, download_url, model_type) {
    console.log("start ch_dl_model_new_version");

    // stop parent event
    stopEvent(e);

    // must confirm before downloading
    const dl_confirm = "\nConfirm to download.\n\nCheck Download Model Section's log and console log for detail.";
    if (!confirm(dl_confirm)) {
        return;
    }

    //get hidden components of extension
    const js_dl_model_new_version_btn = gradioApp().getElementById("ch_js_dl_model_new_version_btn");
    if (!js_dl_model_new_version_btn) {
        return;
    }

    //msg to python side
    const msg = {
        action: "dl_model_new_version",
        model_path: model_path,
        version_id: version_id,
        download_url: download_url,
        model_type: model_type
    };

    // fill to msg box
    send_ch_py_msg(msg);

    //click hidden button
    js_dl_model_new_version_btn.click();

    console.log("end dl_model_new_version");
};


// download model from browser
window.ch_downloader = function(e, model_id) {
    // This isn't the best way to handle this.
    // Shifting the user's window to another tab
    // and then scrolling to an interface is
    // awful design, but hopefully this will
    // just be temporary until I write a new
    // interface.

    console.log("start ch_downloader");

    // stop parent event
    stopEvent(e);

    let tabs;

    tabs = document.querySelectorAll("#tabs button");
    for (let tab of tabs) {
        let text = tab.textContent.trim();
        if (text == "Helper" || text == "Civitai Helper") { // localization nightmare
            tab.click();
            break;
        }
    }

    let single_dl_tab = document.getElementById("ch_dl_single_tab");
    let ch_url = document.querySelector("#ch_dl_url input");
    let ch_get_info_btn = document.getElementById("ch_dl_get_info");
    let ch_download_btn = document.getElementById("ch_download_model_button");
    let old_active = document.querySelector(".ch_active_card");
    let new_active = document.getElementById(`ch_${model_id}_card`);

    single_dl_tab.click();
    ch_url.value = model_id;
    // gradio will not update input value without an input event
    ch_url.dispatchEvent(new Event("input", { bubbles: true }));
    ch_get_info_btn.click();

    ch_download_btn.scrollIntoView();

    if (old_active) {
        old_active.classList.remove("ch_active_card");
    }

    new_active.classList.add("ch_active_card");

    console.log("end ch_downloader");
    return false;
};


function refresh_cards_list(model_type) {
    console.log("refresh card list");
    //refresh card list
    let active_tab = getActiveTabType();
    console.log(`get active tab id: ${active_tab}`);
    if (active_tab) {
        let refresh_btn_id = `${active_tab}_extra_refresh`;
        let refresh_btn = gradioApp().getElementById(refresh_btn_id);
        if (!refresh_btn) {
            // webui 1.8
            refresh_btn_id = `${active_tab}_${model_type}_extra_refresh`;
            refresh_btn = gradioApp().getElementById(refresh_btn_id);
        }
        if (refresh_btn) {
            console.log(`click button: ${refresh_btn_id}`);
            refresh_btn.click();
        }
    }
}

function processCards(tab, extra_tab_els) {
    const prefix_length = tab.length + 1;
    for (const el of extra_tab_els) {
        const model_type = el.id.slice(prefix_length, -6);
        const cards = el.querySelectorAll('.card');
        for (const card of cards) {
            processSingleCard(tab, getShortModelTypeFromFull(model_type), card);
        }
    }
}


function getModelCardsEl(prefix, model_type) {
    const id = prefix + "_" + model_type + "_cards";
    return gradioApp().getElementById(id);
}


function waitForExtraTabs(tab, extra_tabs) {
    function findTabs() {
        const tab_elements = [];
        for (const extra_tab of extra_tabs) {
            const extra_tab_el = getModelCardsEl(tab, extra_tab);

            if (extra_tab_el == null) {

                // XXX lycoris models do not have their own tab in sdwebui 1.5
                // most of the time. In the case that there is a LyCoris tab,
                // it would have been added at the same time as the others,
                // making it almost impossible to be null by the time we're at
                // this point in the code if the other tabs are loaded.
                if (extra_tab == 'lycoris') { continue; }

                return null;
            }

            tab_elements.push(extra_tab_el);
        }
        return tab_elements;
    }

    const tab_elements = findTabs(tab, extra_tabs);
    if (tab_elements) {
        processCards(tab, tab_elements);
    }

    const observer = new MutationObserver(records => {
        let tab_elements;
        for (const record of records) {
            if (record.type != "childList") {
                continue;
            }

            tab_elements = findTabs(tab, extra_tabs);
            if (!tab_elements) {
                return;
            }

            processCards(tab, tab_elements);
            return;
        }
    });

    const extra_networks = getExtraTabs(tab);

    const options = {
        subtree: true,
        childList: true,
    };

    observer.observe(extra_networks, options);
}


function waitForEditor(page, type, name) {
    const id = page + '_' + type + '_edit_user_metadata';

    return new Promise(resolve => {
        let name_field;
        const gradio = gradioApp();

        const editor = gradio.getElementById(id);
        const popup = gradio.querySelector(".global-popup");

        if (popup != null) {
            // hide the editor window so it doesn't get in the user's
            // way while we wait for the replace preview functionality
            // to become available.
            popup.style.display = "none";
        }

        // not only do we need to wait for the editor,
        // but also for it to populate with the model metadata.
        if (editor != null) {
            name_field = editor.querySelector('.extra-network-name');
            if (name_field.textContent.trim() == name) {
                return resolve(editor);
            }
        }

        const observer = new MutationObserver(() => {
            const editor = gradioApp().getElementById(id);
            let name_field;
            if (editor != null) {
                name_field = editor.querySelector('.extra-network-name');
                if (name_field.textContent.trim() == name) {
                    resolve(editor);
                    observer.disconnect();
                }
            }
        });

        observer.observe(document.body, {
            subtree: true,
            childList: true,
        });
    });
}


function getShortModelTypeFromFull(model_type_full) {
    switch (model_type_full) {
        case "textual_inversion":
            return "ti";
        case "hypernetworks":
            return "hyper";
        case "checkpoints":
            return "ckp";
        case "lora":
        case "lycoris":
            return model_type_full;
    }
}


function getLongModelTypeFromShort(model_type_short) {
    switch (model_type_short) {
        case "ti":
            return "textual_inversion";
        case "hyper":
            return "hypernetworks";
        case "ckp":
            return "checkpoints";
        case "lora":
        case "lycoris":
            return model_type_short;
    }
}


let createUI = function() {
    const ul_node = document.createElement('ul');

    const template = document.createElement("a");
    template.href = "#";

    // default mode
    const ch_buttons = {
        replace_preview_button: {
            title: "Replace model preview with currently selected generated image",
            icon: icons.replace_preview,
            className: "replacepreview",
            func: "replace_preview"
        },
        open_url_button: {
            title: "Open this model's civitai url",
            icon: icons.open_url,
            className: "openurl",
            func: "open_model_url"
        },
        add_trigger_words_button: {
            title: "Add trigger words to prompt",
            icon: icons.add_trigger_words,
            className: "addtriggerwords",
            func: "add_trigger_words"
        },
        add_preview_prompt_button: {
            title: "Use prompt from preview image",
            icon: icons.use_preview_prompt,
            className: "usepreviewprompt",
            func: "use_preview_prompt"
        },
        rename_model_button: {
            title: "Rename this model and related files",
            icon: icons.rename_model,
            className: "renamecard",
            func: "rename_card"
        },
        remove_model_button: {
            title: "Remove this model and related files",
            icon: icons.remove_model,
            className: "removecard",
            func: "remove_card"
        }
    };

    let children = {};
    for (const key in ch_buttons) {
        if (opts.ch_hide_buttons.includes(key)) {
            continue;
        }

        let button = ch_buttons[key];
        let el = template.cloneNode();
        el.title = button.title;
        el.textContent = button.icon;
        el.classList.add("card-button", button.className);

        children[key] = button;
        ul_node.appendChild(el);
    }

    createUI = function() {
        const buttons_el = ul_node.cloneNode(true);
        const nodes = {
            parent: buttons_el,
            children: children
        };

        for (const key in children) {
            const child = children[key];
            child.el = buttons_el.querySelector(`.${child.className}`);
        }

        return nodes;
    };

    return createUI();
};

function processSingleCard(active_tab_type, active_extra_tab_type, card) {
    let additional_node = null;
    let ul_node = null;
    let model_name = "";
    let search_term = "";
    let nodes;
    let model_type;

    //additional node
    additional_node = card.querySelector(".actions .additional");

    if (additional_node.querySelector("ul") != null) {
        // buttons have already been added to this card.
        return;
    }

    additional_node.style.display = opts.ch_always_display ? "block" : null;

    model_type = active_extra_tab_type;

    nodes = createUI();
    ul_node = nodes.parent;

    // search_term node
    // search_term: /[subfolder path]/[model name].[ext] [hash]
    // get search_term
    let search_term_nodes = card.querySelectorAll(".actions .additional .search_term, .actions .additional .search_terms");
    if (!search_term_nodes) {
        console.log("can not find search_term node for cards in " + active_tab_type + "_" + active_extra_tab_type + "_cards");
        return;
    }

    if (search_term_nodes.length > 1) {
        let search_terms = [];
        for (let search_term_node of search_term_nodes) {
            search_terms.push(search_term_node.textContent);
        }

        let model_path = search_terms.join(" ");
        let separator = model_path.match(/[\/\\]/)[0];
        model_path = model_path.split(separator).slice(1).join(separator);

        search_term = model_path;
    } else {
        let search_term_node = search_term_nodes[0];
        search_term = search_term_node.textContent;

        // for whatever reason, sometimes search_terms will not include hashes.
        if (search_term_node.classList.contains("search_terms")) {
            let separator = search_term.match(/[\/\\]/)[0];
            search_term = search_term.split(separator).slice(1).join(
                separator === "\\" ? "\\\\" : "/"
            );
        }
    }

    search_term = search_term.replaceAll("\\", "\\\\").replace("'", "\\'");

    if (!search_term) {
        console.log("search_term is empty for cards in " + active_tab_type + "_" + active_extra_tab_type + "_cards");
        return;
    }

    let page = active_tab_type;
    let type = getLongModelTypeFromShort(model_type);
    let name = card.dataset.name.replace("'", "\\'");

    const children = nodes.children;
    for (const key in children) {
        const child = children[key];
        if (child.func == "replace_preview") {
            child.el.setAttribute("onclick", `${child.func}(event, '${page}', '${type}', '${name}')`);
            continue;
        }
        if (child.func == "rename_card") {
            child.el.setAttribute("onclick", `${child.func}(event, '${model_type}', '${search_term}', '${name}')`);
            continue;
        }
        child.el.setAttribute("onclick", `${child.func}(event, '${model_type}', '${search_term}')`);
    }

    additional_node.appendChild(ul_node);
}

onUiLoaded(() => {
    //get gradio version
    const gradio_ver = ch_gradio_version();
    console.log(`Running Stable-Diffusion-Webui-Civitai-Helper on Gradio Version: ${gradio_ver}`);

    // console.log(window.opts);
    // createUI = createUI();

    // get all extra network tabs
    const tab_prefix_list = ["txt2img", "img2img"];
    const model_type_list = ["textual_inversion", "hypernetworks", "checkpoints", "lora", "lycoris"];

    // update extra network tab pages' cards
    // * replace "replace preview" text button into the icon from `icons.replace_preview`.
    // * add 3 button to each card:
    //  - open model url:               `icons.open_url`
    //  - add trigger words:            `icons.add_trigger_words`
    //  - use preview image's prompt    `icons.use_preview_prompt`
    //
    // notice: javascript can not get response from python side
    // so, these buttons just sent request to python
    // then, python side gonna open url and update prompt text box, without telling js side.
    function update_card_for_civitai() {
        replace_preview_text = getTranslation("replace preview");

        if (!replace_preview_text) {
            replace_preview_text = "replace preview";
        }

        let extra_network_node = null;
        let model_type = "";
        let cards = null;

        //get current tab
        let active_tab_type = getActiveTabType();
        if (!active_tab_type) {active_tab_type = "txt2img";}

        for (const tab_prefix of tab_prefix_list) {
            if (tab_prefix != active_tab_type) {
                continue;
            }

            //get active extratab
            const re = new RegExp(`${tab_prefix}_(.+)_cards_html$`);
            const active_extra_tab = Array.from(get_uiCurrentTabContent().querySelectorAll('.extra-network-cards'))
                .find(el => el.closest('.tabitem').style.display === 'block')
                ?.id.match(re)[1];

            const active_extra_tab_type = getShortModelTypeFromFull(active_extra_tab);

            for (const js_model_type of model_type_list) {
                //get model_type for python side
                model_type = getShortModelTypeFromFull(js_model_type);

                if (!model_type) {
                    console.log(`Can not get model_type from: ${js_model_type}`);
                    continue;
                }

                //only handle current sub-tab
                if (model_type != active_extra_tab_type) {
                    continue;
                }

                extra_network_node = getModelCardsEl(tab_prefix, js_model_type);

                // get all card nodes
                cards = extra_network_node.querySelectorAll(".card");
                for (const card of cards) {
                    // don't let an issue with a single card kill functionality for following cards
                    try {
                        processSingleCard(active_tab_type, active_extra_tab_type, card);
                    } catch(err) {
                        console.log(err);
                    }
                }
            }
        }
    }

    //add refresh button to extra network's toolbar
    for (const prefix of tab_prefix_list) {
        const extra_tab = getExtraTabs(prefix);
        const headers = extra_tab.firstChild.children;

        for (const header of headers) {
            const model_type = header.textContent.trim().replace(" ", "_").toLowerCase();

            let extraNetworksClick = () => {
                waitForExtraTabs(prefix, [model_type]);
                header.removeEventListener("click", extraNetworksClick);
            };

            header.addEventListener("click", extraNetworksClick);
        }
    }

    //run it once
    update_card_for_civitai();

    // ========= Experimental ModelInfo Helper UI =========
    function chInitModelInfoHelper() {
        if (!gradioApp().querySelector("#ch_mi_sidebar")) return;
        if (window.__ch_mi_initialized) return;
        window.__ch_mi_initialized = true;

        // Inject scoped styles once
        if (!document.getElementById("ch_mi_style")) {
            const st = document.createElement("style");
            st.id = "ch_mi_style";
            st.textContent = `
#ch_mi_toolbar { align-items:center; gap:8px; }
#ch_mi_slider input { width:140px !important; }
.ch-mi-cat-list { list-style:none; padding:0; margin:0; font-size:12px; line-height:1.3; max-height:70vh; overflow-y:auto;}
.ch-mi-cat-header { margin:8px 0 4px; font-weight:600; opacity:.85; }
.ch-mi-cat-item { cursor:pointer; padding:2px 4px; border-radius:4px; }
.ch-mi-cat-item.active, .ch-mi-cat-item:hover { background:#2a2e36; }
#ch_mi_results_inner.ch-mi-grid { display:flex; flex-wrap:wrap; gap:18px; }
.ch-mi-card { width:180px; background:#181a1f; border:1px solid #2a2e36; border-radius:6px; padding:6px 6px 10px; cursor:pointer; position:relative; }
.ch-mi-card.active { outline:2px solid #4d82ff; }
.ch-mi-thumb { width:100%; aspect-ratio:3/4; background:#222; border-radius:4px; display:flex; align-items:center; justify-content:center; overflow:hidden; font-size:32px; color:#666; }
.ch-mi-thumb img { width:100%; height:100%; object-fit:cover; }
.ch-mi-name { margin-top:6px; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ch-mi-tags { font-size:10px; opacity:.65; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ch-mi-detail { background:#181a1f; border:1px solid #2a2e36; padding:10px 12px; border-radius:6px; font-size:12px; }
.ch-mi-detail-title { font-weight:600; letter-spacing:.5px; margin-bottom:4px; }
.ch-mi-detail-section { border:1px solid #2a2e36; border-radius:4px; margin-bottom:8px; }
.ch-mi-sec-head { font-weight:600; font-size:11px; padding:4px 6px; cursor:pointer; background:#1f2228; display:flex; justify-content:space-between; user-select:none; }
.ch-mi-sec-head:after { content:"-"; }
.ch-mi-sec-head.collapsed:after { content:"+"; }
.ch-mi-sec-body { padding:6px 8px; display:block; }
.ch-mi-sec-head.collapsed + .ch-mi-sec-body { display:none; }
.ch-mi-input, .ch-mi-textarea { width:100%; background:#1f2228; border:1px solid #30343c; border-radius:4px; color:#ddd; font-size:12px; padding:4px 6px; }
.ch-mi-textarea { resize:vertical; }
.ch-mi-badge { background:#245; padding:2px 6px; border-radius:12px; font-size:10px; }
.ch-mi-preview-box { background:#111; border:1px dashed #30343c; min-height:140px; display:flex; align-items:center; justify-content:center; border-radius:4px; overflow:hidden; }
.ch-mi-preview-box img { width:100%; height:auto; object-fit:cover; }
.ch-mi-none { opacity:.5; font-size:11px; }
.ch-mi-detail-actions { display:flex; gap:8px; margin-top:6px; }
.ch-mi-btn { background:#2a2e36; border:1px solid #3a3f47; color:#ddd; padding:4px 10px; font-size:12px; border-radius:4px; cursor:pointer; }
.ch-mi-btn:hover { background:#334155; }
`;
            document.head.appendChild(st);
        }

        // ------- element refs (core interactive nodes) -------
        const catListEl = gradioApp().querySelector("#ch_mi_cat_list");
        const statusEl = gradioApp().querySelector("#ch_mi_status");
        const resultsInner = gradioApp().querySelector("#ch_mi_results_inner");
        const queryEl = gradioApp().querySelector("#ch_mi_query textarea, #ch_mi_query input");
        const customEl = gradioApp().querySelector("#ch_mi_custom textarea, #ch_mi_custom input");
        const sliderEl = gradioApp().querySelector("#ch_mi_slider input");
        const sfwEl = gradioApp().querySelector("#ch_mi_sfw input");
        const refreshBtn = gradioApp().querySelector("#ch_mi_refresh");
        const detail = {
            id: document.getElementById("ch_mi_d_id"),
            type: document.getElementById("ch_mi_d_type"),
            version: document.getElementById("ch_mi_d_version"),
            file: document.getElementById("ch_mi_d_file"),
            base: document.getElementById("ch_mi_d_base"),
            name: document.getElementById("ch_mi_d_name"),
            triggers: document.getElementById("ch_mi_d_triggers"),
            prompt: document.getElementById("ch_mi_d_prompt"),
            neg: document.getElementById("ch_mi_d_neg"),
            weight: document.getElementById("ch_mi_d_weight"),
            desc: document.getElementById("ch_mi_d_desc"),
            previewWrap: document.getElementById("ch_mi_d_preview_wrap"),
            openUrl: document.getElementById("ch_mi_detail_open_url"),
            usePrompt: document.getElementById("ch_mi_detail_use_prompt"),
            panel: document.getElementById("ch_mi_detail_panel"),
        };

        // ------- categories (mock placeholder; replace with API later) -------
        const demoCats = [
            {group:"BUILD-IN", items:["CKP","HYPER","LORA","TI"]},
            {group:"LORA", items:["Character","Real","Semi","Style","Scene","Item","Face","Cloth","Animal"]},
            {group:"MISC", items:["Workflow","Preset","Other"]},
            {group:"CUSTOM", items:[]}
        ];
        function renderCats() {
            catListEl.innerHTML = "";
            demoCats.forEach(sec=>{
                const h = document.createElement("li");
                h.textContent = sec.group;
                h.className = "ch-mi-cat-header";
                catListEl.appendChild(h);
                sec.items.forEach(name=>{
                    const li=document.createElement("li");
                    li.textContent=name;
                    li.className="ch-mi-cat-item";
                    li.dataset.cat=name;
                    li.addEventListener("click",()=>{
                        catListEl.querySelectorAll(".ch-mi-cat-item.active").forEach(n=>n.classList.remove("active"));
                        li.classList.add("active");
                        loadResults();
                    });
                    catListEl.appendChild(li);
                });
            });
        }

        // ------- data mock (temporary local dataset builder) -------
        function buildMockModels(params) {
            const count = params.page_size;
            const out=[];
            for(let i=0;i<count;i++){
                out.push({
                    id: "cv_"+(1000+i),
                    name: `Model_${i+1}`,
                    type: (params.category||"HYPER"),
                    version: "v1",
                    base: "SDXL",
                    file: "model_"+(i+1)+".safetensors",
                    preview: i%2===0 ? "https://placehold.co/300x400?text="+(i+1) : null,
                    triggers: ["tagA","tagB"],
                    prompt: "",
                    neg: "",
                    weight:"0.7",
                    url: "https://civitai.com/models/"+(5000+i),
                    desc: "Sample description "+(i+1)
                });
            }
            return out;
        }

        // ------- state holders -------
        let currentModels = [];
        let selected = null;

        // ------- populate detail panel with selected model -------
        function populateDetail(m){
            if(!m)return;
            selected = m;
            detail.id.textContent = m.id;
            detail.type.textContent = m.type;
            detail.version.textContent = m.version;
            detail.file.textContent = m.file;
            detail.base.textContent = m.base;
            detail.name.value = m.name;
            detail.triggers.value = m.triggers.join(", ");
            detail.prompt.value = m.prompt;
            detail.neg.value = m.neg;
            detail.weight.value = m.weight;
            detail.desc.value = m.desc;
            detail.previewWrap.innerHTML = m.preview ? `<img src="${m.preview}">` : `<span class="ch-mi-none">No Preview</span>`;
            detail.openUrl.onclick = ()=> window.open(m.url,"_blank");
            detail.usePrompt.onclick = ()=> {
                // 既存「Use Preview Prompt」ブリッジに接続するならここで send_ch_py_msg を利用可能
                alert("Prompt機能は今後実装予定");
            };
        }

        // ------- render model cards grid -------
        function renderCards(models){
            resultsInner.innerHTML="";
            models.forEach(m=>{
                const card=document.createElement("div");
                card.className="ch-mi-card";
                card.dataset.id=m.id;
                card.innerHTML=`
<div class="ch-mi-thumb">${m.preview?`<img src="${m.preview}">`:"🖼️"}</div>
<div class="ch-mi-name" title="${m.name}">${m.name}</div>
<div class="ch-mi-tags">${m.type}</div>`;
                card.addEventListener("click",()=>{
                    resultsInner.querySelectorAll(".ch-mi-card.active").forEach(n=>n.classList.remove("active"));
                    card.classList.add("active");
                    populateDetail(m);
                });
                resultsInner.appendChild(card);
            });
        }

        // ------- fetch & build results (simulate async for now) -------
        function loadResults() {
            const activeCat = catListEl.querySelector(".ch-mi-cat-item.active");
            const category = activeCat ? activeCat.dataset.cat : "";
            const query = queryEl ? queryEl.value.trim() : "";
            const custom = customEl ? customEl.value.trim() : "";
            const page_size = sliderEl ? parseInt(sliderEl.value) : 32;
            const sfw = sfwEl ? sfwEl.checked : false;
            statusEl.innerHTML = `選択: ${category||"All"} | 件数:${page_size} | SFW:${sfw?"On":"Off"} ${query?("| "+query):""} ${custom?("| C:"+custom):""}`;
            resultsInner.innerHTML="<div class='ch-mi-loading'>Loading...</div>";
            setTimeout(()=>{
                currentModels = buildMockModels({category,query,custom,page_size,sfw});
                renderCards(currentModels);
                if(currentModels.length>0){
                    populateDetail(currentModels[0]);
                    resultsInner.firstChild.classList.add("active");
                } else {
                    populateDetail(null);
                }
            },120);
        }

        // ------- collapsible detail sections (toggle show/hide) -------
        detail.panel.querySelectorAll(".ch-mi-sec-head").forEach(head=>{
            head.addEventListener("click",()=>{
                head.classList.toggle("collapsed");
            });
        });

        // ------- event bindings (toolbar & inputs) -------
        refreshBtn?.addEventListener("click", loadResults);
        ["change","keyup"].forEach(ev=>{
            queryEl?.addEventListener(ev, e=> { if(ev==="change") loadResults(); });
            customEl?.addEventListener(ev, e=> { if(ev==="change") loadResults(); });
        });
        sliderEl?.addEventListener("change", loadResults);
        sfwEl?.addEventListener("change", loadResults);

        renderCats();
        loadResults();
    }

    // External API: rebuild sidebar categories (future dynamic usage)
    window.ch_build_modelinfo_sidebar = function(categories){
        const el = gradioApp().querySelector("#ch_mi_cat_list");
        if(!el) return;
        el.innerHTML="";
        categories.forEach(sec=>{
            const h=document.createElement("li");
            h.textContent=sec.group;
            h.className="ch-mi-cat-header";
            el.appendChild(h);
            sec.items.forEach(name=>{
                const li=document.createElement("li");
                li.className="ch-mi-cat-item";
                li.textContent=name;
                li.dataset.cat=name;
                el.appendChild(li);
            });
        });
    };

    // Initialize experimental UI (no-op if disabled)
    try { chInitModelInfoHelper(); } catch(e){ console.log(e); }

})();
