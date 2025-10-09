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

    # 追加: レイアウト/CSS/アクセシビリティ対応用スタイルとスクリプト
    gr.HTML(
        """
        <style>
        /* Layout root */
        #ch_browser_wrapper {display:flex; flex-direction:column; gap:8px;}

        /* Search bar */
        #search-bar {display:flex; justify-content:center; align-items:center; gap:12px; flex-wrap:wrap;}
        #query-box, #query-box textarea {width:500px !important; min-width:500px !important;}
        #search-btn {width:200px !important; min-width:200px !important; height:40px !important;}

        /* Sidebar + results layout */
        #search-layout {display:flex; align-items:flex-start; gap:16px;}
        #filter-sidebar {width:20%; min-width:260px; max-width:360px; display:flex; flex-direction:column; gap:10px;}
        #results-area {flex:1; min-width:0;}

        /* Uniform input/button styling removal */
        #query-box textarea,
        #search-btn,
        #tag-box textarea,
        #model-type-box select,
        #base-model-box select,
        #sort-box select,
        #age-box select,
        #nsfw-box input {
            box-shadow:none !important;
            outline:none !important;
            border:1px solid #ccc !important;
            height:40px !important;
            padding:6px 10px;
        }

        /* Cards grid */
        #ch_model_search_results .cards_container {
            display:grid;
            grid-template-columns:repeat(auto-fill,minmax(200px,1fr));
            gap:14px;
        }
        .model_card {
            width:200px;
            box-sizing:border-box;
            border:1px solid #ddd;
            border-radius:6px;
            background:#222;
            padding:6px;
            display:flex;
            flex-direction:column;
            gap:4px;
        }
        .model_card:focus {
            outline:2px solid #6aa0ff;
            outline-offset:2px;
        }
        .model_card .preview_container {
            width:200px;
            height:200px;
            overflow:hidden;
            border-radius:4px;
            background:#111;
            display:flex;
            align-items:center;
            justify-content:center;
        }
        .model_card .model_preview {
            width:100%;
            height:100%;
            object-fit:cover;
            display:block;
        }
        .model_card .title {
            font-size:13px;
            font-weight:600;
            line-height:1.2;
            max-height:2.4em;
            overflow:hidden;
        }
        .model_card .description {font-size:12px; line-height:1.2; max-height:6.0em; overflow:hidden;}
        .model_card .model_meta {font-size:11px; display:flex; flex-direction:column; gap:2px;}
        /* Pagination buttons align */
        #pagination-row {display:flex; gap:8px; justify-content:center; margin-top:8px;}
        </style>
        <script>
        (function(){
          function hookAccessibility(){
            const qArea = document.querySelector('#query-box textarea');
            const searchBtn = document.querySelector('#search-btn');
            if(qArea){
              qArea.setAttribute('aria-label','Model search query');
              qArea.addEventListener('keydown', e=>{
                if(e.key==='Enter'){ e.preventDefault(); searchBtn?.click(); }
                else if(e.key==='Escape'){ qArea.value=''; qArea.dispatchEvent(new Event('input')); }
              });
            }
            const triggerOnEnterIds = ['tag-box','model-type-box','base-model-box','sort-box','age-box'];
            triggerOnEnterIds.forEach(id=>{
              const el = document.querySelector('#'+id+' select, #'+id+' textarea');
              if(el){
                el.addEventListener('keydown', e=>{
                  if(e.key==='Enter'){ e.preventDefault(); searchBtn?.click(); }
                });
              }
            });
            // Delegate Enter on focused card to open downloader (first anchor)
            document.addEventListener('keydown', e=>{
              if(e.key==='Enter' && document.activeElement?.classList.contains('model_card')){
                 const a = document.activeElement.querySelector('.preview a, a');
                 if(a){ a.click(); }
              }
              if(e.key==='Escape' && document.activeElement?.classList.contains('model_card')){
                 document.activeElement.blur();
              }
            });
          }
          document.addEventListener('DOMContentLoaded', hookAccessibility);
          // In case of dynamic mount
          setTimeout(hookAccessibility, 1500);
        })();
        </script>
        """,
    )

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

    # --- UI レイアウト再構成 ---

    with gr.Column(elem_id="ch_browser_wrapper"):

        with gr.Row(elem_id="search-bar"):
            ch_query_txt = gr.Textbox(
                label="",
                value="",
                elem_id="query-box",
                placeholder="Search models...",
                lines=1,
                min_width=500
            )
            ch_search_btn = gr.Button(
                value="Search",
                elem_id="search-btn",
                variant="primary",
                min_width=200
            )

        with gr.Row(elem_id="search-layout"):
            # サイドバー
            with gr.Column(elem_id="filter-sidebar"):
                ch_tag_txt = gr.Textbox(
                    label="Tag",
                    value="",
                    elem_id="tag-box",
                    lines=1,
                    min_width=300
                )
                ch_type_drop = gr.Dropdown(
                    label="Model Type",
                    value=None,
                    multiselect=True,
                    elem_id="model-type-box",
                    choices=[
                        # TODO: Perhaps make this list external so it can be updated independent of CH version.
                        "Checkpoint","TextualInversion","Hypernetwork","AestheticGradient","LORA",
                        "LoCon","DoRA","Controlnet","Poses","Workflows","MotionModule","Upscaler",
                        "Wildcards","VAE"
                    ],
                    min_width=300
                )
                ch_base_model_drop = gr.Dropdown(
                    label="Base Model",
                    value=None,
                    multiselect=True,
                    elem_id="base-model-box",
                    choices=SUPPORTED_MODELS,
                    min_width=300
                )
                ch_sort_drop = gr.Dropdown(
                    label="Sort",
                    value="Newest",
                    elem_id="sort-box",
                    choices=[
                        "Highest Rated",
                        "Most Downloaded",
                        "Newest"
                    ],
                    min_width=300
                )
                ch_age_drop = gr.Dropdown(
                    label="Model Age",
                    value="AllTime",
                    elem_id="age-box",
                    choices=["AllTime","Year","Month","Week","Day"],
                    min_width=300
                )
                ch_nsfw_ckb = gr.Checkbox(
                    label="Allow NSFW",
                    value=util.get_opts("ch_nsfw_threshold") != "PG",
                    elem_id="nsfw-box"
                )
                # ページングボタンをサイドバー下部に移動しても良いが要求は未指定。中央でも表示するため後続 row で。
            # 結果領域
            with gr.Column(elem_id="results-area"):
                with gr.Row(elem_id="pagination-row"):
                    ch_prev_btn = gr.Button(
                        value="Previous",
                        interactive=False
                    )
                    ch_next_btn = gr.Button(
                        value="Next",
                        interactive=False
                    )
                with gr.Box():
                    ch_search_results_html = gr.HTML(
                        value="",
                        label="Search Results",
                        elem_id="ch_model_search_results"
                    )

    # inputs/outputs 再構成 (変数参照更新)
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
    outputs = [
        ch_search_state,
        ch_search_results_html,
        ch_prev_btn,
        ch_next_btn
    ]

    ch_search_btn.click(
        perform_search,
        inputs=inputs,
        outputs=outputs
    )
    ch_prev_btn.click(
        perform_search,
        inputs=inputs,
        outputs=outputs
    )
    ch_next_btn.click(
        perform_search,
        inputs=inputs,
        outputs=outputs
    )

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
