""" -*- coding: UTF-8 -*-
browser.py - Model Browser for Helper
"""

import os
from string import Template
import gradio as gr
from ch_lib import util
from ch_lib import civitai

from .supported_models import SUPPORTED_MODELS

def civitai_search():
    """
        Gradio UI
    """

    with gr.Blocks(
        analytics_enabled=False
    ) as browser:

        make_ui()

    return browser


def make_ui():
    ch_search_state = gr.State({
        "current_page": 0,
        "pages": []
    })

    def perform_search(
        state,
        query,
        tag,
        age,
        sort,
        base_models,
        types,
        allow_nsfw,
        evt: gr.EventData
    ):

        search = {}

        target = evt.target

        url = ""

        if target in [ch_prev_btn, ch_next_btn]:
            if target == ch_prev_btn:
                state["current_page"] = state["current_page"] - 1

            if target == ch_next_btn:
                state["current_page"] = state["current_page"] + 1

            url = state["pages"][state["current_page"]]

        if not url:
            search["query"] = query
            search["tag"] = tag
            search["period"] = age
            search["sort"] = sort
            search["baseModels"] = base_models
            search["types"] = types
            search["nsfw"] = "true" if allow_nsfw else "false"

            params = make_params(search)

            url = f"{civitai.URLS['query']}{params}"

        if len(state["pages"]) == 0:
            state["pages"].append(url)

        util.printD(f"Loading data from API request: {url}")

        json = civitai.civitai_get(url)

        if not json:
            return [
                {},
                "Civitai did not provide a useable response."
            ]

        content = parse_civitai_response(json)

        meta = content.get("meta", {})
        next_page = meta.get("next_page", None)

        if next_page not in state:
            state["pages"].append(next_page)

        cards = make_cards(content["models"])

        container = quick_template_from_file("container.html")

        if util.GRADIO_FALLBACK:
            return [
                state,
                container.safe_substitute({"cards": "".join(cards)}),
                ch_prev_btn.update(interactive=state["current_page"] > 0),  # Enable/disable buttons
                ch_next_btn.update(interactive=next_page is not None)
            ]

        return [
            state,
            container.safe_substitute({"cards": "".join(cards)}),
            gr.Button(interactive=state["current_page"] > 0),  # Enable/disable buttons
            gr.Button(interactive=next_page is not None)
        ]

    gr.HTML(
        """
<style>
/* --- Top Bar Layout Adjustments --- */
#ch_filter_bar {
  display:flex;
  align-items:center;
  gap:.6rem;
  width:100%;
  margin-bottom:.4rem;
}
#ch_filter_bar #ch_filter_toggle_btn {flex:0 0 auto;}
#ch_filter_bar #ch_browser_query {flex:1 1 auto; margin:0;}
#ch_browser_query label {display:none;}
#ch_browser_query input, #ch_browser_query textarea {
  height:2.1em;
  padding:.25em .75em;
  font-size:1.02rem;
  line-height:1.1;
}
#ch_filter_toggle_btn button {
  --btn-size:2.1em;
  width:var(--btn-size);
  height:var(--btn-size);
  padding:0;
  display:flex;
  align-items:center;
  justify-content:center;
  background:#333;
  color:#fff;
  border-radius:8px;
  font-size:0;
  position:relative;
}
#ch_filter_toggle_btn button::before {
  content:"";
  width:55%;
  height:55%;
  background:#fff;
  display:block;
  -webkit-mask:url("data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg' fill='%23ffffff'><path d='M3 4h18c.55 0 1 .45 1 1 0 .21-.07.41-.2.58L15 14.01V20c0 .55-.45 1-1 1-.21 0-.41-.07-.58-.2l-4-3.2A1 1 0 0 1 9 16v-1.99L2.2 5.58A1 1 0 0 1 2 5c0-.55.45-1 1-1z'/></svg>") center / contain no-repeat;
  mask:url("data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><path d='M3 4h18c.55 0 1 .45 1 1 0 .21-.07.41-.2.58L15 14.01V20c0 .55-.45 1-1 1-.21 0-.41-.07-.58-.2l-4-3.2A1 1 0 0 1 9 16v-1.99L2.2 5.58A1 1 0 0 1 2 5c0-.55.45-1 1-1z'/></svg>") center / contain no-repeat;
}
#ch_filter_toggle_btn button[aria-expanded="true"] {background:#555;}
#ch_filter_toggle_btn button:focus-visible {outline:2px solid #888; outline-offset:2px;}
/* Search button next to query */
#ch_browser_search_btn button {
  height:2.1em;
  padding:0 1.0em;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:.9rem;
  line-height:1;
  white-space:nowrap;
}

/* Main area alignment (sidebar + results) */
#ch_main_area {
  display:flex;
  align-items:flex-start; /* top aligned */
  gap:0;
}

/* Sidebar unchanged logic (collapsible) */
#ch_filter_sidebar {
  flex:0 0 var(--ch-sidebar-width);
  width:var(--ch-sidebar-width);
  max-width:var(--ch-sidebar-width);
  transition: width .25s ease, padding .25s ease, opacity .18s ease;
  padding:0 .5rem .75rem .25rem;
  box-sizing:border-box;
}
#ch_filter_sidebar.closed {
  width:0;
  flex-basis:0;
  padding:0;
  opacity:0;
  overflow:hidden;
}

/* Results container flex growth */
#ch_results_container {
  flex:1 1 auto;
  min-width:0;
  width:100%;
  transition: width .25s ease;
}

/* Grid (constant card min width, columns count adjusts with available width) */
#ch_model_search_results .cards_container {
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(var(--ch-card-min, 200px), 1fr));
  gap:.75rem;
  align-content:start;
}

/* Mobile overlay keeps same toggle behavior */
@media (max-width: 900px){
  #ch_filter_sidebar {
    position:fixed;
    top:0;left:0;bottom:0;
    z-index:1001;
    width:var(--ch-sidebar-width,250px);
    max-width:80vw;
    overflow-y:auto;
    background:var(--body-background-fill);
    box-shadow:2px 0 12px rgba(0,0,0,.35);
    padding:0 .75rem .9rem .65rem;
    transform:translateX(0);
    transition:transform .25s ease, opacity .25s ease;
    opacity:1;
  }
  #ch_filter_sidebar.closed {
    transform:translateX(-120%);
    width:var(--ch-sidebar-width,250px);
    opacity:0;
  }
  #ch_filter_backdrop {
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.35);
    backdrop-filter:blur(2px);
    z-index:1000;
    opacity:0;
    pointer-events:none;
    transition:opacity .25s ease;
  }
  #ch_filter_backdrop.show {
    opacity:1;
    pointer-events:auto;
  }
}

@media (prefers-reduced-motion: reduce){
  #ch_filter_sidebar,
  #ch_results_container,
  #ch_filter_backdrop,
  #ch_filter_bar,
  #ch_browser_search_btn button {
    transition:none !important;
  }
}
</style>
        """
    )

    with gr.Column(elem_id="ch_filter_wrapper"):
        with gr.Row(elem_id="ch_filter_bar"):
            ch_filter_toggle_btn = gr.Button(
                value=" ",
                elem_id="ch_filter_toggle_btn"
            )
            ch_query_txt = gr.Textbox(
                label="Query",
                value="",
                elem_id="ch_browser_query",
                placeholder="Enter model name or keywords",
            )
            ch_search_btn = gr.Button(      # moved from sidebar to top bar
                value="Search",
                variant="primary",
                elem_id="ch_browser_search_btn"
            )

    with gr.Row(elem_id="ch_main_area", equal_height=False):
        with gr.Column(scale=0, min_width=0, elem_id="ch_filter_sidebar"):
            ch_tag_txt = gr.Textbox(label="Tag", value="", elem_id="ch_browser_tag")
            ch_age_drop = gr.Dropdown(label="Model Age", value="AllTime",
                                      choices=["AllTime","Year","Month","Week","Day"])
            ch_sort_drop = gr.Dropdown(label="Sort By", value="Newest",
                                       choices=["Highest Rated","Most Downloaded","Newest"])
            ch_base_model_drop = gr.Dropdown(label="Base Model", value=None,
                                             multiselect=True, choices=SUPPORTED_MODELS)
            ch_type_drop = gr.Dropdown(label="Model Type", value=None, multiselect=True,
                                       choices=["Checkpoint","TextualInversion","Hypernetwork","AestheticGradient",
                                                "LORA","LoCon","DoRA","Controlnet","Poses","Workflows",
                                                "MotionModule","Upscaler","Wildcards","VAE"])
            ch_nsfw_ckb = gr.Checkbox(label="Allow NSFW Models",
                                      value=util.get_opts("ch_nsfw_threshold") != "PG")
            with gr.Row():
                ch_prev_btn = gr.Button(value="Prev", interactive=False)
                ch_next_btn = gr.Button(value="Next", interactive=False)
        with gr.Column(scale=4, elem_id="ch_results_container"):
            gr.HTML("<div id='ch_filter_backdrop' class=''></div>")
            with gr.Box():
                ch_search_results_html = gr.HTML(
                    value="",
                    label="Search Results",
                    elem_id="ch_model_search_results"
                )

    # Update inputs list (removed search button from sidebar, logic unchanged)
    inputs = [
        ch_search_state,
        ch_query_txt,
        ch_tag_txt,
        ch_age_drop,
        ch_sort_drop,
        ch_base_model_drop,
        ch_type_drop,
        ch_nsfw_ckb
    ]
    outputs = [ch_search_state, ch_search_results_html, ch_prev_btn, ch_next_btn]

    ch_search_btn.click(perform_search, inputs=inputs, outputs=outputs)
    ch_prev_btn.click(perform_search, inputs=inputs, outputs=outputs)
    ch_next_btn.click(perform_search, inputs=inputs, outputs=outputs)

def array_frags(name, vals, frags):
    if len(vals) == 0:
        return frags

    for val in vals:
        frags.append(f"{name}={val}")

    return frags


def make_params(params):
    frags = []
    for key, val in params.items():
        if not val or val == "":
            continue

        if key in ["types", "baseModels"]:
            frags = array_frags(key, val, frags)
            continue

        frags.append(f"{key}={val}")

    return '&'.join(frags)


def parse_model(model):
    name = model["name"]
    description = model["description"]
    url = f"{civitai.URLS['modelPage']}{model['id']}"
    model_type = model["type"]
    base_models = []
    preview = {
        "type": None,
        "url": None
    }
    versions = {
        # ID: base_model,
    }

    download = ""

    files = None
    model_versions = model["modelVersions"]

    if len(model_versions) > 0:
        files = model_versions[0].get("files", [])

    previews = []

    for version in model_versions:
        images = version.get("images", [])
        if len(images) > 0:
            previews = previews + images
        base_model = version.get("baseModel", None)
        if base_model and (base_model not in base_models):
            base_models.append(base_model)

        versions[version["id"]] = base_model

    nsfw_preview_threshold = util.get_opts("ch_nsfw_threshold")

    for file in previews:
        if file["type"] != "image":
            continue

        if civitai.NSFW_LEVELS[nsfw_preview_threshold] < file["nsfwLevel"]:
            continue

        preview["url"] = file["url"]
        preview["type"] = file["type"]

        break

    if files:
        for file in files:
            if file["type"] != "Model":
                continue
            download = file.get("downloadUrl", None)
            break

    return {
        "id": model["id"],
        "name": name,
        "preview": {
            "url": preview["url"],
            "type": preview["type"]
        },
        "url": url,
        "versions": versions,
        "description": description,
        "type": model_type,
        "download": download,
        "base_models": base_models,
    }

def parse_civitai_response(content):
    results = {
        "models": [],
        "meta": {
            "next_page": None
        }
    }

    if content.get("metadata", False):
        results["meta"]["next_page"] = content["metadata"].get("nextPage", None)

    for model in content["items"]:
        try:
            results["models"].append(parse_model(model))

        except Exception as e:
            # TODO: better error handling
            util.printD(e)
            util.printD(model)

    return results


def quick_template_from_file(filename):
    file = os.path.join(str(util.script_dir), "browser/templates", str(filename))
    with open(file, "r", encoding="utf-8") as text:
        template = Template(text.read())
    return template


def make_cards(models):
    card_template = quick_template_from_file("model_card.html")
    preview_template = quick_template_from_file("image_preview.html")
    # video_preview_template = quick_template_from_file("video_preview.html")

    cards = []
    for model in models:
        preview = ""
        if model["preview"]["url"]:
            preview = preview_template.safe_substitute({"preview_url": model["preview"]["url"]})

        card = card_template.safe_substitute({
            "name": model["name"],
            "preview": preview,
            "url": model["url"],
            "base_models": " / ".join(model["base_models"]),
            #"versions": model["versions"],
            "description": model["description"],
            "type": model["type"],
            "model_id": model["id"],
        })

        cards.append(card)

    return cards
