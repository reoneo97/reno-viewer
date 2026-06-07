import type { Anchor } from '../types'
import { getToken } from '../api/client'

const API_BASE = (import.meta.env.VITE_API_URL as string) ?? ''

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function exportSnapshot(floorPlanUrl: string, anchors: Anchor[]) {
  const html = await buildSnapshotHtml(floorPlanUrl, anchors)
  const blob = new Blob([html], { type: 'text/html' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'floor-plan-snapshot.html'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

async function buildSnapshotHtml(floorPlanUrl: string, anchors: Anchor[]): Promise<string> {
  const floorPlan = await urlToBase64(floorPlanUrl)
  const resolvedAnchors = await Promise.all(
    anchors.map(async (anchor) => ({
      ...anchor,
      candidates: await Promise.all(
        anchor.candidates.map(async (c) => ({ ...c, urls: await Promise.all(c.urls.map(urlToBase64)) }))
      ),
    }))
  )
  const safeJson = JSON.stringify({ floorPlan, anchors: resolvedAnchors })
    .replace(/<\/script>/gi, '<\\/script>')
  return buildHtml(safeJson)
}

export async function shareSnapshot(floorPlanUrl: string, anchors: Anchor[]): Promise<string> {
  const html = await buildSnapshotHtml(floorPlanUrl, anchors)

  const res = await fetch(`${API_BASE}/snapshots`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/html',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: html,
  })

  if (!res.ok) throw new Error('Failed to create snapshot')

  const { url } = await res.json()
  // Return absolute URL usable from anywhere
  const origin = API_BASE || window.location.origin
  return `${origin}${url}`
}

function buildHtml(safeJson: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Floor Plan</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #0f0f1a; color: #e0e0e0; height: 100vh; overflow: hidden; }
    .toolbar { display: flex; align-items: center; gap: 12px; padding: 10px 20px;
               background: #16213e; border-bottom: 1px solid #2a2a4a; }
    .app-title { font-weight: 700; font-size: 1.1rem; color: #a8d8ea; letter-spacing: .05em; }
    .view-badge { margin-left: auto; font-size: .72rem; font-weight: 600; color: #888;
                  background: #222; border: 1px solid #333; border-radius: 20px; padding: 3px 10px; }
    .main-area { height: calc(100vh - 45px); display: flex; align-items: center;
                 justify-content: center; overflow: hidden; }
    .canvas-container { width: 100%; height: 100%; display: flex; align-items: center;
                        justify-content: center; overflow: hidden; cursor: grab; user-select: none; }
    .canvas-inner { position: relative; display: inline-block; transform-origin: center center; }
    .floor-plan-img { display: block; max-width: 90vw; max-height: 85vh; width: auto; height: auto; }
    .anchor-wrapper { position: absolute; transform: translate(-50%, -50%); z-index: 20; }
    .anchor-pin { position: relative; width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
                  transform: rotate(-45deg); background: #4a90d9; border: 2px solid #fff;
                  box-shadow: 0 2px 8px rgba(0,0,0,.4); cursor: default; }
    .anchor-pin.has-items { background: #27ae60; }
    .candidate-badge { position: absolute; top: -6px; right: -6px; transform: rotate(45deg);
                       background: #e74c3c; color: #fff; font-size: 9px; font-weight: 700;
                       width: 16px; height: 16px; border-radius: 50%; display: flex;
                       align-items: center; justify-content: center; }
    .candidate-popover { position: absolute; bottom: calc(100% + 12px); left: 50%;
                         transform: translateX(-50%); background: #1e1e3a;
                         border: 1px solid #3a3a6a; border-radius: 10px; padding: 12px;
                         min-width: 220px; max-width: 340px; box-shadow: 0 8px 32px rgba(0,0,0,.5);
                         z-index: 100; pointer-events: none; }
    .popover-header { font-size: .75rem; font-weight: 700; color: #a8d8ea; text-transform: uppercase;
                      letter-spacing: .08em; margin-bottom: 10px; border-bottom: 1px solid #3a3a6a;
                      padding-bottom: 6px; }
    .popover-category { margin-left: 8px; font-size: .65rem; font-weight: 600; color: #666;
                        text-transform: none; letter-spacing: 0; background: #2a2a4a;
                        padding: 1px 6px; border-radius: 10px; }
    .candidate-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 8px; }
    .candidate-card { display: flex; flex-direction: column; align-items: center; gap: 3px; }
    .candidate-card img { width: 72px; height: 72px; object-fit: cover; border-radius: 6px;
                          border: 1px solid #3a3a6a; }
    .candidate-name { font-size: .65rem; color: #aaa; text-align: center; max-width: 88px;
                      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .candidate-meta { font-size: .6rem; color: #666; text-align: center; max-width: 88px; }
    .candidate-price { font-size: .68rem; font-weight: 700; color: #27ae60; text-align: center; }
    .candidate-link { font-size: .6rem; color: #4a90d9; text-align: center; text-decoration: none; }
    .candidate-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="app-title">Reno Viewer</span>
    <span class="view-badge">View Only</span>
  </div>
  <div class="main-area">
    <div class="canvas-container" id="canvasContainer">
      <div class="canvas-inner" id="canvasInner">
        <img id="floorPlanImg" class="floor-plan-img" alt="Floor plan" draggable="false">
      </div>
    </div>
  </div>
  <script>
    var DATA = ${safeJson};

    var floorPlanImg = document.getElementById('floorPlanImg');
    var canvasInner  = document.getElementById('canvasInner');
    var canvasContainer = document.getElementById('canvasContainer');

    floorPlanImg.src = DATA.floorPlan;

    var scale = 1, offset = { x: 0, y: 0 }, isPanning = false;
    var panStart = { x: 0, y: 0, ox: 0, oy: 0 };

    function updateTransform() {
      canvasInner.style.transform =
        'translate(' + offset.x + 'px, ' + offset.y + 'px) scale(' + scale + ')';
    }

    canvasContainer.addEventListener('wheel', function(e) {
      e.preventDefault();
      scale = Math.min(Math.max(scale * (e.deltaY > 0 ? 0.9 : 1.1), 0.3), 5);
      updateTransform();
    }, { passive: false });

    canvasContainer.addEventListener('mousedown', function(e) {
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      canvasContainer.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', function(e) {
      if (!isPanning) return;
      offset = { x: panStart.ox + (e.clientX - panStart.x), y: panStart.oy + (e.clientY - panStart.y) };
      updateTransform();
    });

    window.addEventListener('mouseup', function() {
      isPanning = false;
      canvasContainer.style.cursor = 'grab';
    });

    DATA.anchors.forEach(function(anchor) {
      var wrapper = document.createElement('div');
      wrapper.className = 'anchor-wrapper';
      wrapper.style.left = anchor.x + '%';
      wrapper.style.top  = anchor.y + '%';

      var pin = document.createElement('div');
      pin.className = 'anchor-pin' + (anchor.candidates.length > 0 ? ' has-items' : '');

      if (anchor.candidates.length > 0) {
        var badge = document.createElement('span');
        badge.className = 'candidate-badge';
        badge.textContent = anchor.candidates.length;
        pin.appendChild(badge);
      }

      wrapper.appendChild(pin);

      var popover = buildPopover(anchor);
      wrapper.addEventListener('mouseenter', function() {
        wrapper.appendChild(popover);
      });
      wrapper.addEventListener('mouseleave', function() {
        if (popover.parentNode) popover.parentNode.removeChild(popover);
      });

      canvasInner.appendChild(wrapper);
    });

    function buildPopover(anchor) {
      var pop = document.createElement('div');
      pop.className = 'candidate-popover';

      var hdr = document.createElement('div');
      hdr.className = 'popover-header';
      hdr.textContent = anchor.label;
      if (anchor.category) {
        var cat = document.createElement('span');
        cat.className = 'popover-category';
        cat.textContent = anchor.category;
        hdr.appendChild(cat);
      }
      pop.appendChild(hdr);

      if (anchor.candidates.length > 0) {
        var grid = document.createElement('div');
        grid.className = 'candidate-grid';

        anchor.candidates.forEach(function(c) {
          var card = document.createElement('div');
          card.className = 'candidate-card';

          var img = document.createElement('img');
          img.src = c.url;
          img.alt = c.name;
          card.appendChild(img);

          var name = document.createElement('p');
          name.className = 'candidate-name';
          name.textContent = c.name;
          card.appendChild(name);

          var dims = [c.width, c.height, c.depth].filter(Boolean).join(' × ');
          if (dims) {
            var meta = document.createElement('p');
            meta.className = 'candidate-meta';
            meta.textContent = dims;
            card.appendChild(meta);
          }

          if (c.price) {
            var price = document.createElement('p');
            price.className = 'candidate-price';
            price.textContent = '$' + c.price;
            card.appendChild(price);
          }

          if (c.link) {
            var link = document.createElement('a');
            link.className = 'candidate-link';
            link.href = c.link;
            link.target = '_blank';
            link.rel = 'noreferrer';
            link.textContent = 'View ↗';
            card.appendChild(link);
          }

          grid.appendChild(card);
        });

        pop.appendChild(grid);
      } else {
        var empty = document.createElement('p');
        empty.style.cssText = 'font-size:.75rem;color:#666;margin-top:4px;';
        empty.textContent = 'No candidates added';
        pop.appendChild(empty);
      }

      return pop;
    }
  </script>
</body>
</html>`
}
