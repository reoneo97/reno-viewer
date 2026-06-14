import base64
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from sqlmodel import Session, select

from ..db import get_session
from ..models import AnchorCandidate, Candidate, DEFAULT_CATEGORIES, Project
from .. import storage

router = APIRouter(tags=["snapshots"])


# ── HTML generation ───────────────────────────────────────────────────────────

def _key_to_data_url(key: str) -> str:
    data = storage.download(key)
    if not data:
        return ""
    ext = key.rsplit(".", 1)[-1].lower()
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            "gif": "image/gif", "webp": "image/webp"}.get(ext, "image/jpeg")
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def _price_of(value: str | None) -> float:
    try:
        n = float(value or "")
        return n if n > 0 else 0.0
    except ValueError:
        return 0.0


def _compute_budget(anchors_data: list[dict]) -> dict:
    """Per-category committed (chosen) vs all-options totals for the share page."""
    lines: dict[str, dict] = {}
    undecided = 0
    for a in anchors_data:
        priced = [c for c in a["candidates"] if _price_of(c["price"]) > 0]
        if not priced:
            continue
        if not any(c["chosen"] for c in a["candidates"]):
            undecided += 1
        line = lines.setdefault(a["category"] or "Uncategorised", {"total": 0.0, "chosen": 0.0})
        for c in priced:
            line["total"] += _price_of(c["price"])
            if c["chosen"]:
                line["chosen"] += _price_of(c["price"])
    ordered = sorted(
        ({"category": k, **v} for k, v in lines.items()),
        key=lambda l: -l["total"],
    )
    return {
        "lines": ordered,
        "total": sum(l["total"] for l in ordered),
        "chosen": sum(l["chosen"] for l in ordered),
        "undecided": undecided,
    }


def _project_to_snapshot_data(project: Project, session: Session, inline: bool) -> dict:
    """Build the share-page payload.

    `inline=True` embeds every image as a base64 data URL (self-contained file
    for downloads); `inline=False` uses presigned R2 URLs, keeping the live
    share page small and fast.
    """
    to_url = _key_to_data_url if inline else storage.presigned_url

    link_rows = session.exec(
        select(AnchorCandidate).where(
            AnchorCandidate.anchor_id.in_([a.id for a in project.anchors])  # type: ignore[attr-defined]
        )
    ).all() if project.anchors else []
    chosen_set = {(r.anchor_id, r.candidate_id) for r in link_rows if r.status == "chosen"}

    anchors_data = [
        {
            "id": str(a.id),
            "x": a.x,
            "y": a.y,
            "label": a.label,
            "category": a.category or "",
            "candidates": [
                {
                    "id": str(c.id),
                    "name": c.name,
                    "urls": [to_url(p.image_key) for p in c.photos if p.image_key],
                    "description": c.description or "",
                    "width": c.width or "",
                    "height": c.height or "",
                    "depth": c.depth or "",
                    "price": c.price or "",
                    "link": c.link or "",
                    "chosen": (a.id, c.id) in chosen_set,
                }
                for c in a.candidates
            ],
        }
        for a in project.anchors
    ]

    cats = project.categories if project.categories is not None else DEFAULT_CATEGORIES
    return {
        "floorPlan": to_url(project.floor_plan_key) if project.floor_plan_key else "",
        "anchors": anchors_data,
        "budget": _compute_budget(anchors_data),
        "categoryColors": {c["name"]: c["color"] for c in cats},
    }


def _build_html(data: dict) -> str:
    safe_json = json.dumps(data).replace("</script>", "<\\/script>")
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Floor Plan</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    html, body {{ height: 100vh; height: 100dvh; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #0f0f1a; color: #e0e0e0; overflow: hidden; display: flex; flex-direction: column;
           -webkit-tap-highlight-color: transparent; }}
    .toolbar {{ display: flex; align-items: center; gap: 12px; padding: 10px 20px; flex-shrink: 0;
               background: #16213e; border-bottom: 1px solid #2a2a4a; }}
    .app-title {{ font-weight: 700; font-size: 1.1rem; color: #a8d8ea; letter-spacing: .05em; }}
    .view-badge {{ margin-left: auto; font-size: .72rem; font-weight: 600; color: #888;
                  background: #222; border: 1px solid #333; border-radius: 20px; padding: 3px 10px; }}

    /* ── Layout ── */
    .layout {{ display: flex; flex: 1; overflow: hidden; }}
    .canvas-area {{ flex: 1; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }}
    .canvas-container {{ width: 100%; height: 100%; display: flex; align-items: center;
                        justify-content: center; overflow: hidden; cursor: grab; user-select: none;
                        touch-action: none; }}
    .canvas-inner {{ position: relative; display: inline-block; transform-origin: center center; }}
    .floor-plan-img {{ display: block; max-width: 100%; max-height: 100%; width: auto; height: auto; }}

    /* ── Sidebar ── */
    .sidebar {{ width: 300px; flex-shrink: 0; background: #16213e; border-left: 1px solid #2a2a4a;
               overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }}
    /* Keep cards at natural height so the sidebar scrolls instead of
       squashing them flat when its own height is constrained (mobile). */
    .sidebar > * {{ flex-shrink: 0; }}
    .sidebar-anchor {{ border: 1px solid #2a2a4a; border-radius: 8px; overflow: hidden; transition: border-color 0.2s; }}
    .sidebar-anchor.active {{ border-color: var(--cat-color, #4a90d9); }}
    .sidebar-anchor-header {{ display: flex; align-items: center; gap: 8px; padding: 10px 12px;
                              background: #1e1e3a; border-bottom: 1px solid #2a2a4a;
                              border-left: 3px solid transparent; }}
    .sidebar-anchor.active .sidebar-anchor-header {{ border-left-color: var(--cat-color, #4a90d9); }}
    .sidebar-color-dot {{ width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }}
    .sidebar-anchor-name {{ font-size: .82rem; font-weight: 700; color: #e0e0e0; flex: 1;
                            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
    .sidebar-category-tag {{ font-size: .62rem; color: #888; background: #2a2a4a;
                             padding: 1px 6px; border-radius: 10px; white-space: nowrap; }}
    .sidebar-candidates {{ display: flex; flex-direction: column; }}
    .sidebar-candidate {{ display: flex; gap: 10px; padding: 10px 12px; border-bottom: 1px solid #1a1a30; }}
    .sidebar-candidate:last-child {{ border-bottom: none; }}
    .sidebar-candidate img, .sidebar-no-img {{ width: 52px; height: 52px; object-fit: cover;
                              border-radius: 4px; flex-shrink: 0; border: 1px solid #2a2a4a; }}
    .sidebar-no-img {{ background: #0f0f1a; }}
    .sidebar-img-strip {{ display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }}
    .sidebar-img-strip img {{ width: 52px; height: 52px; object-fit: cover; border-radius: 4px; border: 1px solid #2a2a4a; display: block; }}
    .sidebar-candidate-info {{ flex: 1; display: flex; flex-direction: column; gap: 3px; justify-content: center; min-width: 0; }}
    .sidebar-candidate-name {{ font-size: .78rem; font-weight: 600; color: #ccc;
                               overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
    .sidebar-candidate-desc {{ font-size: .65rem; color: #888; line-height: 1.3; white-space: normal; }}
    .sidebar-candidate-dims {{ font-size: .65rem; color: #666; }}
    .sidebar-candidate-price {{ font-size: .72rem; font-weight: 700; color: #27ae60; }}
    .sidebar-candidate-link {{ font-size: .65rem; color: #4a90d9; text-decoration: none; }}
    .sidebar-candidate-link:hover {{ text-decoration: underline; }}
    .sidebar-empty {{ font-size: .75rem; color: #555; padding: 8px 12px; }}

    /* ── Budget summary card ── */
    .budget-card {{ border: 1px solid #2a2a4a; border-radius: 8px; background: #1e1e3a; padding: 12px; }}
    .budget-card-title {{ font-size: .68rem; font-weight: 700; text-transform: uppercase;
                          letter-spacing: .08em; color: #888; margin-bottom: 8px; }}
    .budget-figures {{ display: flex; gap: 14px; margin-bottom: 8px; }}
    .budget-figure-label {{ font-size: .62rem; color: #888; display: block; }}
    .budget-figure-value {{ font-size: .95rem; font-weight: 700; color: #e0e0e0; font-variant-numeric: tabular-nums; }}
    .budget-figure-value.chosen {{ color: #27ae60; }}
    .budget-line {{ display: flex; justify-content: space-between; font-size: .7rem; color: #aaa; padding: 2px 0; }}
    .budget-line-amounts {{ font-variant-numeric: tabular-nums; }}
    .budget-line-chosen {{ color: #27ae60; font-weight: 600; }}
    .budget-undecided {{ font-size: .65rem; color: #777; margin-top: 6px; }}

    /* ── Anchor pins ── */
    .anchor-wrapper {{ position: absolute; transform: translate(-50%, -50%); z-index: 20; cursor: pointer; }}
    .anchor-pin {{ position: relative; width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
                  transform: rotate(-45deg); border: 2px solid #fff;
                  box-shadow: 0 2px 8px rgba(0,0,0,.4); transition: transform .15s; }}
    .anchor-wrapper:hover .anchor-pin {{ transform: rotate(-45deg) scale(1.15); }}
    .candidate-badge {{ position: absolute; top: -6px; right: -6px; transform: rotate(45deg);
                       background: #e74c3c; color: #fff; font-size: 9px; font-weight: 700;
                       width: 16px; height: 16px; border-radius: 50%; display: flex;
                       align-items: center; justify-content: center; }}

    /* ── Popover ── */
    .candidate-popover {{ position: absolute; bottom: calc(100% + 12px); left: 50%;
                         transform: translateX(-50%); background: #1e1e3a;
                         border: 1px solid #3a3a6a; border-radius: 10px; padding: 12px;
                         min-width: 240px; max-width: 320px; box-shadow: 0 8px 32px rgba(0,0,0,.5);
                         z-index: 100; pointer-events: none; }}
    .popover-header {{ font-size: .75rem; font-weight: 700; color: #a8d8ea; text-transform: uppercase;
                      letter-spacing: .08em; margin-bottom: 10px; border-bottom: 1px solid #3a3a6a;
                      padding-bottom: 6px; display: flex; align-items: center; gap: 8px; }}
    .popover-category {{ font-size: .65rem; font-weight: 600; color: #666; text-transform: none;
                        letter-spacing: 0; background: #2a2a4a; padding: 1px 6px; border-radius: 10px; }}
    .candidate-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }}
    .candidate-card {{ position: relative; width: 100%; aspect-ratio: 1; border-radius: 6px;
                      overflow: hidden; pointer-events: auto; }}
    .candidate-card img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
    .candidate-overlay {{ position: absolute; inset: 0; background: rgba(10,10,26,.88); border-radius: 6px;
                         opacity: 0; transition: opacity .15s; display: flex; flex-direction: column;
                         align-items: center; justify-content: center; gap: 3px; padding: 8px; text-align: center; }}
    .candidate-card:hover .candidate-overlay {{ opacity: 1; }}
    .candidate-name {{ font-size: .68rem; font-weight: 600; color: #e0e0e0; max-width: 100%;
                      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
    .candidate-meta {{ font-size: .6rem; color: #999; }}
    .candidate-price {{ font-size: .72rem; font-weight: 700; color: #27ae60; }}
    .candidate-link {{ font-size: .62rem; color: #4a90d9; text-decoration: none; pointer-events: auto; }}
    .candidate-link:hover {{ text-decoration: underline; }}
    .no-candidates {{ font-size: .75rem; color: #666; margin-top: 4px; }}

    /* ── Legend ── */
    .legend {{ position: absolute; bottom: 20px; left: 20px; background: rgba(30,30,58,.92);
               border: 1px solid #3a3a6a; border-radius: 8px; padding: 10px 14px;
               display: flex; flex-direction: column; gap: 6px; pointer-events: none;
               backdrop-filter: blur(4px); z-index: 30; }}
    .legend-item {{ display: flex; align-items: center; gap: 8px; }}
    .legend-dot {{ width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; border: 1px solid rgba(255,255,255,.2); }}
    .legend-label {{ font-size: .72rem; color: #ccc; white-space: nowrap; }}

    /* ── Mobile: stack the plan above a full-width item list ── */
    @media (max-width: 760px) {{
      .layout {{ flex-direction: column; }}
      .canvas-area {{ flex: none; height: 52vh; height: 52dvh; border-bottom: 1px solid #2a2a4a; }}
      .sidebar {{ width: 100%; flex: 1; border-left: none; padding: 12px; }}
      .legend {{ bottom: 10px; left: 10px; padding: 8px 10px; max-width: 60vw; }}
      .sidebar-candidate img, .sidebar-no-img,
      .sidebar-img-strip img {{ width: 60px; height: 60px; }}
      /* Popovers can be wide on a phone — let them use the screen width */
      .candidate-popover {{ max-width: 78vw; }}
    }}
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="app-title">Reno Viewer</span>
    <span class="view-badge">View Only</span>
  </div>
  <div class="layout">
    <div class="canvas-area">
      <div class="canvas-container" id="canvasContainer">
        <div class="canvas-inner" id="canvasInner">
          <img id="floorPlanImg" class="floor-plan-img" alt="Floor plan" draggable="false">
        </div>
      </div>
    </div>
    <div class="sidebar" id="sidebar"></div>
  </div>
  <script>
    var DATA = {safe_json};

    // Colours come from the project's own category list (embedded above).
    var CATEGORY_COLORS = DATA.categoryColors || {{}};
    function anchorColor(cat) {{ return CATEGORY_COLORS[cat] || '#7f8c8d'; }}

    var floorPlanImg   = document.getElementById('floorPlanImg');
    var canvasInner    = document.getElementById('canvasInner');
    var canvasContainer = document.getElementById('canvasContainer');
    var sidebar        = document.getElementById('sidebar');

    floorPlanImg.src = DATA.floorPlan;

    var scale = 1, offset = {{ x: 0, y: 0 }}, isPanning = false;
    var panStart = {{ x: 0, y: 0, ox: 0, oy: 0 }};

    function updateTransform() {{
      canvasInner.style.transform = 'translate(' + offset.x + 'px,' + offset.y + 'px) scale(' + scale + ')';
    }}

    var clampScale = function(s) {{ return Math.min(Math.max(s, 0.3), 5); }};

    canvasContainer.addEventListener('wheel', function(e) {{
      e.preventDefault();
      scale = clampScale(scale * (e.deltaY > 0 ? 0.9 : 1.1));
      updateTransform();
    }}, {{ passive: false }});

    // Pointer-based pan + pinch-zoom — works for mouse and touch alike.
    var pointers = {{}};
    var pinch = {{ dist: 0, scale: 1, mx: 0, my: 0, ox: 0, oy: 0 }};
    var dist = function(a, b) {{ return Math.hypot(a.x - b.x, a.y - b.y); }};
    var pts = function() {{ return Object.keys(pointers).map(function(k) {{ return pointers[k]; }}); }};

    canvasContainer.addEventListener('pointerdown', function(e) {{
      pointers[e.pointerId] = {{ x: e.clientX, y: e.clientY }};
      var p = pts();
      if (p.length === 2) {{
        pinch = {{ dist: dist(p[0], p[1]), scale: scale,
                  mx: (p[0].x + p[1].x) / 2, my: (p[0].y + p[1].y) / 2, ox: offset.x, oy: offset.y }};
        isPanning = false;
      }} else if (p.length === 1) {{
        isPanning = true;
        panStart = {{ x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }};
        canvasContainer.style.cursor = 'grabbing';
      }}
    }});
    canvasContainer.addEventListener('pointermove', function(e) {{
      if (!(e.pointerId in pointers)) return;
      pointers[e.pointerId] = {{ x: e.clientX, y: e.clientY }};
      var p = pts();
      if (p.length === 2) {{
        var d = dist(p[0], p[1]);
        var mid = {{ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }};
        scale = clampScale(pinch.scale * (pinch.dist ? d / pinch.dist : 1));
        offset = {{ x: pinch.ox + (mid.x - pinch.mx), y: pinch.oy + (mid.y - pinch.my) }};
        updateTransform();
      }} else if (p.length === 1 && isPanning) {{
        offset = {{ x: panStart.ox + (e.clientX - panStart.x), y: panStart.oy + (e.clientY - panStart.y) }};
        updateTransform();
      }}
    }});
    var endPointer = function(e) {{
      delete pointers[e.pointerId];
      var p = pts();
      if (p.length === 1) {{
        isPanning = true;
        panStart = {{ x: p[0].x, y: p[0].y, ox: offset.x, oy: offset.y }};
      }} else if (p.length === 0) {{
        isPanning = false;
        canvasContainer.style.cursor = 'grab';
      }}
    }};
    canvasContainer.addEventListener('pointerup', endPointer);
    canvasContainer.addEventListener('pointercancel', endPointer);

    // ── Budget summary card ──
    var BUDGET = DATA.budget || {{ lines: [], total: 0, chosen: 0, undecided: 0 }};
    function fmtMoney(n) {{
      return '$' + n.toLocaleString(undefined, {{ minimumFractionDigits: 2, maximumFractionDigits: 2 }});
    }}
    if (BUDGET.lines.length > 0) {{
      var card = document.createElement('div');
      card.className = 'budget-card';
      card.innerHTML = '<div class="budget-card-title">Budget</div>';

      var figures = document.createElement('div');
      figures.className = 'budget-figures';
      [['Chosen', BUDGET.chosen, true], ['All options', BUDGET.total, false]].forEach(function(f) {{
        var fig = document.createElement('div');
        var lbl = document.createElement('span');
        lbl.className = 'budget-figure-label';
        lbl.textContent = f[0];
        var val = document.createElement('span');
        val.className = 'budget-figure-value' + (f[2] ? ' chosen' : '');
        val.textContent = fmtMoney(f[1]);
        fig.appendChild(lbl); fig.appendChild(val);
        figures.appendChild(fig);
      }});
      card.appendChild(figures);

      BUDGET.lines.forEach(function(l) {{
        var row = document.createElement('div');
        row.className = 'budget-line';
        var cat = document.createElement('span');
        cat.textContent = l.category;
        var amounts = document.createElement('span');
        amounts.className = 'budget-line-amounts';
        if (l.chosen > 0) {{
          var ch = document.createElement('span');
          ch.className = 'budget-line-chosen';
          ch.textContent = fmtMoney(l.chosen);
          amounts.appendChild(ch);
          amounts.appendChild(document.createTextNode(' / '));
        }}
        amounts.appendChild(document.createTextNode(fmtMoney(l.total)));
        row.appendChild(cat); row.appendChild(amounts);
        card.appendChild(row);
      }});

      if (BUDGET.undecided > 0) {{
        var und = document.createElement('div');
        und.className = 'budget-undecided';
        und.textContent = BUDGET.undecided + ' spot' + (BUDGET.undecided !== 1 ? 's' : '') + ' still undecided';
        card.appendChild(und);
      }}
      sidebar.appendChild(card);
    }}

    // Build sidebar + anchor pins together
    var sidebarSections = {{}};

    DATA.anchors.forEach(function(anchor) {{
      var color = anchorColor(anchor.category);

      // ── Sidebar section ──
      var section = document.createElement('div');
      section.className = 'sidebar-anchor';
      section.style.setProperty('--cat-color', color);

      var hdr = document.createElement('div');
      hdr.className = 'sidebar-anchor-header';

      var dot = document.createElement('span');
      dot.className = 'sidebar-color-dot';
      dot.style.background = color;

      var nameEl = document.createElement('span');
      nameEl.className = 'sidebar-anchor-name';
      nameEl.textContent = anchor.label;

      hdr.appendChild(dot);
      hdr.appendChild(nameEl);

      if (anchor.category) {{
        var tag = document.createElement('span');
        tag.className = 'sidebar-category-tag';
        tag.textContent = anchor.category;
        hdr.appendChild(tag);
      }}
      section.appendChild(hdr);

      if (anchor.candidates.length > 0) {{
        var list = document.createElement('div');
        list.className = 'sidebar-candidates';
        anchor.candidates.forEach(function(c) {{
          var row = document.createElement('div');
          row.className = 'sidebar-candidate';
          if (c.urls && c.urls.length > 0) {{
            var strip = document.createElement('div');
            strip.className = 'sidebar-img-strip';
            c.urls.forEach(function(url) {{
              var img = document.createElement('img');
              img.src = url; img.alt = c.name;
              strip.appendChild(img);
            }});
            row.appendChild(strip);
          }} else {{
            var noImg = document.createElement('div');
            noImg.className = 'sidebar-no-img';
            row.appendChild(noImg);
          }}
          var info = document.createElement('div');
          info.className = 'sidebar-candidate-info';

          var nm = document.createElement('div');
          nm.className = 'sidebar-candidate-name';
          nm.textContent = (c.chosen ? '★ ' : '') + c.name;
          if (c.chosen) nm.style.color = '#f1c40f';
          info.appendChild(nm);

          if (c.description) {{
            var desc = document.createElement('div');
            desc.className = 'sidebar-candidate-desc';
            desc.textContent = c.description;
            info.appendChild(desc);
          }}

          var dimsVal = [c.width ? 'W ' + c.width : '', c.height ? 'H ' + c.height : '', c.depth ? 'D ' + c.depth : ''].filter(Boolean).join(' × ') || '—';
          var d = document.createElement('div');
          d.className = 'sidebar-candidate-dims';
          d.textContent = dimsVal;
          info.appendChild(d);

          var p = document.createElement('div');
          p.className = 'sidebar-candidate-price';
          p.textContent = c.price ? '$' + c.price : '—';
          info.appendChild(p);

          if (c.link) {{
            var a = document.createElement('a');
            a.className = 'sidebar-candidate-link';
            a.href = c.link; a.target = '_blank'; a.rel = 'noreferrer';
            a.textContent = 'View ↗';
            info.appendChild(a);
          }}
          row.appendChild(info);
          list.appendChild(row);
        }});
        section.appendChild(list);
      }} else {{
        var empty = document.createElement('div');
        empty.className = 'sidebar-empty';
        empty.textContent = 'No candidates';
        section.appendChild(empty);
      }}

      sidebar.appendChild(section);
      sidebarSections[anchor.id] = section;

      // ── Floor plan pin ──
      var wrapper = document.createElement('div');
      wrapper.className = 'anchor-wrapper';
      wrapper.style.left = anchor.x + '%';
      wrapper.style.top  = anchor.y + '%';

      var pin = document.createElement('div');
      pin.className = 'anchor-pin';
      pin.style.background = color;

      if (anchor.candidates.length > 0) {{
        var badge = document.createElement('span');
        badge.className = 'candidate-badge';
        badge.textContent = anchor.candidates.length;
        pin.appendChild(badge);
      }}
      wrapper.appendChild(pin);

      // Hover (desktop) shows the popover; tap (touch) toggles it, since
      // there is no hover on touch screens.
      var popover = buildPopover(anchor);
      var showPopover = function() {{
        wrapper.appendChild(popover);
        section.classList.add('active');
        section.scrollIntoView({{ behavior: 'smooth', block: 'nearest' }});
      }};
      var hidePopover = function() {{
        if (popover.parentNode) popover.parentNode.removeChild(popover);
        section.classList.remove('active');
      }};
      wrapper.addEventListener('mouseenter', showPopover);
      wrapper.addEventListener('mouseleave', hidePopover);
      // Tap toggles on touch; closes any other open popover first.
      pin.addEventListener('click', function(e) {{
        e.stopPropagation();
        var open = popover.parentNode;
        document.querySelectorAll('.candidate-popover').forEach(function(p) {{
          if (p.parentNode) p.parentNode.removeChild(p);
        }});
        document.querySelectorAll('.sidebar-anchor.active').forEach(function(s) {{ s.classList.remove('active'); }});
        if (!open) showPopover();
      }});

      canvasInner.appendChild(wrapper);
    }});

    // Legend
    var usedCats = [...new Set(DATA.anchors.map(function(a) {{ return a.category; }}).filter(Boolean))];
    if (usedCats.length > 0) {{
      var legend = document.createElement('div');
      legend.className = 'legend';
      usedCats.forEach(function(cat) {{
        var item = document.createElement('div');
        item.className = 'legend-item';
        var ldot = document.createElement('span');
        ldot.className = 'legend-dot';
        ldot.style.background = anchorColor(cat);
        var llabel = document.createElement('span');
        llabel.className = 'legend-label';
        llabel.textContent = cat;
        item.appendChild(ldot);
        item.appendChild(llabel);
        legend.appendChild(item);
      }});
      document.querySelector('.canvas-area').appendChild(legend);
    }}

    function buildPopover(anchor) {{
      var pop = document.createElement('div');
      pop.className = 'candidate-popover';

      var hdr = document.createElement('div');
      hdr.className = 'popover-header';
      hdr.textContent = anchor.label;
      if (anchor.category) {{
        var cat = document.createElement('span');
        cat.className = 'popover-category';
        cat.textContent = anchor.category;
        hdr.appendChild(cat);
      }}
      pop.appendChild(hdr);

      if (anchor.candidates.length > 0) {{
        var grid = document.createElement('div');
        grid.className = 'candidate-grid';
        anchor.candidates.forEach(function(c) {{
          var card = document.createElement('div');
          card.className = 'candidate-card';
          if (c.chosen) card.style.outline = '2px solid #f1c40f';
          if (c.urls && c.urls[0]) {{
            var img = document.createElement('img');
            img.src = c.urls[0]; img.alt = c.name;
            card.appendChild(img);
          }}
          if (c.chosen) {{
            var star = document.createElement('span');
            star.textContent = '★';
            star.style.cssText = 'position:absolute;top:4px;left:4px;color:#f1c40f;font-size:0.9rem;text-shadow:0 1px 3px rgba(0,0,0,0.8);z-index:2;';
            card.appendChild(star);
          }}
          var overlay = document.createElement('div');
          overlay.className = 'candidate-overlay';
          var nm = document.createElement('p');
          nm.className = 'candidate-name';
          nm.textContent = c.name;
          overlay.appendChild(nm);
          var dims = [c.width ? 'W ' + c.width : '', c.height ? 'H ' + c.height : '', c.depth ? 'D ' + c.depth : ''].filter(Boolean).join(' × ');
          if (dims) {{
            var meta = document.createElement('p');
            meta.className = 'candidate-meta';
            meta.textContent = dims;
            overlay.appendChild(meta);
          }}
          if (c.price) {{
            var price = document.createElement('p');
            price.className = 'candidate-price';
            price.textContent = '$' + c.price;
            overlay.appendChild(price);
          }}
          if (c.link) {{
            var link = document.createElement('a');
            link.className = 'candidate-link';
            link.href = c.link; link.target = '_blank'; link.rel = 'noreferrer';
            link.textContent = 'View ↗';
            overlay.appendChild(link);
          }}
          card.appendChild(overlay);
          grid.appendChild(card);
        }});
        pop.appendChild(grid);
      }} else {{
        var empty = document.createElement('p');
        empty.className = 'no-candidates';
        empty.textContent = 'No candidates added';
        pop.appendChild(empty);
      }}
      return pop;
    }}
  </script>
</body>
</html>"""


def render_share_page(project_id: uuid.UUID, session: Session) -> str | None:
    """Render the public share page fresh from the database (used by the
    public GET route in main.py). Images are presigned URLs, not inlined, so
    the page is small and always shows the latest state of the project."""
    project = session.get(Project, project_id)
    if not project:
        return None
    return _build_html(_project_to_snapshot_data(project, session, inline=False))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/snapshot", status_code=201)
def create_snapshot(project_id: uuid.UUID, session: Session = Depends(get_session)):
    """Return the shareable URL. The page itself renders live on each visit,
    so there is nothing to generate or upload here any more — the link always
    reflects the current state of the project."""
    if not session.get(Project, project_id):
        raise HTTPException(404, "Project not found")
    return {"id": str(project_id), "url": f"/snapshots/{project_id}"}


@router.get("/projects/{project_id}/snapshot/download")
def download_snapshot(project_id: uuid.UUID, session: Session = Depends(get_session)):
    """Frozen, self-contained copy: every image inlined as base64 so the file
    works offline and never changes after download."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    data = _project_to_snapshot_data(project, session, inline=True)
    html = _build_html(data)
    filename = f"{project.name.replace(' ', '_')}.html"

    return Response(
        content=html.encode(),
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
