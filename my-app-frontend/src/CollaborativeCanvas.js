import React, { useEffect, useRef } from 'react';
// Add these imports for Firestore
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { auth } from './firebaseConfig';

const CollaborativeCanvas = ({ user }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !user) return;

    // Inject styles for the canvas and textboxes
    const style = document.createElement('style');
    style.innerHTML = `
      .collab-canvas-root {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        min-height: 100vh;
        min-width: 100vw;
        overflow: hidden;
        font-family: 'Inter', sans-serif;
        z-index: 0;
      }
      #canvas-bg {
        background-color: #f8fafc;
        background-image: radial-gradient(#d1d5db 1px, transparent 0);
        background-size: 20px 20px;
        width: 10000px;
        height: 5000px;
        position: absolute;
        top: 0;
        left: 0;
        cursor: pointer;
        z-index: 1;
      }
      .textbox {
        position: absolute;
        padding: 12px;
        border-radius: 8px;
        background-color: #fef08a;
        border: 1px solid #facc15;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        cursor: move;
        min-width: 150px;
        min-height: 80px;
        resize: both;
        overflow: hidden;
        z-index: 2;
      }
      .textbox:focus-within {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }
      .textbox-content {
        width: 100%;
        height: 100%;
        outline: none;
        cursor: text;
      }
      .textbox::-webkit-resizer {
        display: none;
      }
      #canvas-container {
        overflow: auto !important;
        width: 100vw;
        height: 100vh;
        position: absolute;
        inset: 0;
        z-index: 1;
      }
      .canvas-header-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        z-index: 10;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .canvas-header-bar {
        margin-top: 16px;
        background: rgba(255,255,255,0.85);
        border-radius: 12px;
        box-shadow: 0 2px 8px 0 rgb(0 0 0 / 0.04);
        padding: 12px 32px;
        display: flex;
        align-items: center;
        gap: 16px;
        pointer-events: auto;
      }
      .canvas-header-bar .title {
        font-weight: bold;
        font-size: 1.5rem;
        color: #334155;
      }
      .canvas-header-bar .desc {
        font-size: 1rem;
        color: #64748b;
      }
      .canvas-header-bar .zoom {
        font-size: 0.95rem;
        color: #334155;
        background: #f1f5f9;
        border-radius: 8px;
        padding: 2px 10px;
        margin-left: 8px;
      }
      .canvas-header-bar .userid {
        font-size: 0.85rem;
        color: #64748b;
        background: #f1f5f9;
        border-radius: 8px;
        padding: 2px 10px;
        margin-left: 8px;
        font-family: monospace;
      }
    `;
    document.head.appendChild(style);

    containerRef.current.innerHTML = `
      <div class="canvas-header-overlay">
        <div class="canvas-header-bar">
          <span class="title">Collaborative Canvas</span>
          <span class="desc">Double-click to add a note</span>
          <span id="zoom-indicator" class="zoom">Zoom: 100%</span>
          <span class="userid">User: <span id="user-id-display"></span></span>
        </div>
      </div>
      <div id="canvas-container">
        <div id="canvas-bg"></div>
      </div>
    `;

    // Set user ID
    const userIdDisplay = containerRef.current.querySelector('#user-id-display');
    if (userIdDisplay && user) {
      userIdDisplay.textContent = user.uid;
    }

    containerRef.current.classList.add('collab-canvas-root');

    // --- FIRESTORE SETUP ---
    const db = getFirestore();
    const appId = "collaborative-canvas";
    const textboxesCollectionRef = collection(
      db,
      'artifacts',
      appId,
      'users',
      user.uid,
      'textboxes'
    );

    // --- INTERACTIVE LOGIC ---
    const canvas = containerRef.current.querySelector('#canvas-bg');
    const canvasContainer = containerRef.current.querySelector('#canvas-container');
    const zoomIndicator = containerRef.current.querySelector('#zoom-indicator');
    let dragState = {
      dragging: false,
      target: null,
      offsetX: 0,
      offsetY: 0,
      textboxId: null,
      initialX: 0,
      initialY: 0,
    };

    // --- Canvas Drag State ---
    let canvasDrag = {
      dragging: false,
      startX: 0,
      startY: 0,
      origScrollLeft: 0,
      origScrollTop: 0,
    };

    // --- Zoom State ---
    let zoom = 1.0;
    const MIN_ZOOM = 0.2;
    const MAX_ZOOM = 3.0;
    const ZOOM_STEP = 0.01;

    function updateZoomIndicator() {
      if (zoomIndicator) {
        zoomIndicator.textContent = `Zoom: ${Math.round(zoom * 100)}%`;
      }
    }

    function setCanvasZoom(newZoom, centerX, centerY) {
      const prevZoom = zoom;
      zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      canvas.style.transformOrigin = "0 0";
      canvas.style.transform = `scale(${zoom})`;
      // Also scale all textboxes
      Array.from(canvas.querySelectorAll('.textbox')).forEach(tb => {
        tb.style.transformOrigin = "0 0";
        tb.style.transform = `scale(${zoom})`;
      });
      updateZoomIndicator();

      // Adjust scroll to keep the zoom centered on the pointer (if provided)
      if (typeof centerX === "number" && typeof centerY === "number") {
        const containerRect = canvasContainer.getBoundingClientRect();
        const mouseX = centerX - containerRect.left + canvasContainer.scrollLeft;
        const mouseY = centerY - containerRect.top + canvasContainer.scrollTop;
        const logicalX = mouseX / prevZoom;
        const logicalY = mouseY / prevZoom;
        canvasContainer.scrollLeft = logicalX * zoom - (centerX - containerRect.left);
        canvasContainer.scrollTop = logicalY * zoom - (centerY - containerRect.top);
      }
    }

    // --- Sync: Render textboxes from Firestore ---
    function renderTextbox(id, data) {
      let textbox = canvas.querySelector(`#${id}`);
      if (!textbox) {
        textbox = document.createElement('div');
        textbox.className = 'textbox';
        textbox.id = id;
        textbox.style.transformOrigin = "0 0";
        textbox.style.transform = `scale(${zoom})`;

        const content = document.createElement('div');
        content.className = 'textbox-content';
        content.contentEditable = 'true';
        content.innerText = data.text || '';

        // Save text on blur
        content.addEventListener('blur', async () => {
          await setDoc(doc(textboxesCollectionRef, id), {
            ...data,
            text: content.innerText,
            x: parseFloat(textbox.style.left),
            y: parseFloat(textbox.style.top),
          }, { merge: true });
        });

        textbox.appendChild(content);

        // Drag logic
        textbox.addEventListener('mousedown', (ev) => {
          if (ev.target !== textbox) return;
          ev.stopPropagation();
          dragState.dragging = true;
          dragState.target = textbox;
          dragState.textboxId = id;
          dragState.offsetX = (ev.clientX - textbox.getBoundingClientRect().left) / zoom;
          dragState.offsetY = (ev.clientY - textbox.getBoundingClientRect().top) / zoom;
          dragState.initialX = parseFloat(textbox.style.left);
          dragState.initialY = parseFloat(textbox.style.top);
          document.addEventListener('mousemove', handleDrag);
          document.addEventListener('mouseup', handleMouseUp);
        });

        // Right-click to delete
        textbox.addEventListener('contextmenu', async (ev) => {
          ev.preventDefault();
          await deleteDoc(doc(textboxesCollectionRef, id));
        });

        canvas.appendChild(textbox);
      }
      // Always update position and text to match Firestore, but only if not dragging
      if (!dragState.dragging || dragState.textboxId !== id) {
        textbox.style.left = data.x + 'px';
        textbox.style.top = data.y + 'px';
        textbox.style.transform = `scale(${zoom})`;
        const content = textbox.querySelector('.textbox-content');
        if (content && content.innerText !== data.text) {
          content.innerText = data.text;
        }
      }
    }

    // --- Listen for Firestore changes ---
    const unsubscribe = onSnapshot(textboxesCollectionRef, (snapshot) => {
      // Remove deleted
      snapshot.docChanges().forEach(change => {
        if (change.type === "removed") {
          const el = canvas.querySelector(`#${change.doc.id}`);
          if (el) el.remove();
        }
      });
      // Add/update
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        renderTextbox(docSnap.id, data);
      });
    });

    // Add a new textbox on double-click (sync to Firestore)
    function handleDblClick(e) {
      if (e.target !== canvas) return;
      const containerRect = canvasContainer.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left + canvasContainer.scrollLeft;
      const mouseY = e.clientY - containerRect.top + canvasContainer.scrollTop;
      const x = mouseX / zoom;
      const y = mouseY / zoom;
      const id = 'textbox-' + Math.random().toString(36).slice(2);
      setDoc(doc(textboxesCollectionRef, id), {
        text: 'New Note',
        x: x - 75,
        y: y - 40,
      });
    }

    function handleDrag(ev) {
      if (!dragState.dragging || !dragState.target) return;
      const canvasRect = canvas.getBoundingClientRect();
      let x = (ev.clientX - canvasRect.left + canvasContainer.scrollLeft) / zoom - dragState.offsetX;
      let y = (ev.clientY - canvasRect.top + canvasContainer.scrollTop) / zoom - dragState.offsetY;
      x = Math.max(0, Math.min(x, 10000 - dragState.target.offsetWidth));
      y = Math.max(0, Math.min(y, 5000 - dragState.target.offsetHeight));
      dragState.target.style.left = x + 'px';
      dragState.target.style.top = y + 'px';
    }

    async function handleMouseUp() {
      if (dragState.dragging && dragState.target && dragState.textboxId) {
        // Save new position to Firestore
        await setDoc(doc(textboxesCollectionRef, dragState.textboxId), {
          x: parseFloat(dragState.target.style.left),
          y: parseFloat(dragState.target.style.top),
          text: dragState.target.querySelector('.textbox-content').innerText,
        }, { merge: true });
      }
      dragState.dragging = false;
      dragState.target = null;
      dragState.textboxId = null;
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    // --- Canvas Drag Logic (scroll the container for panning) ---
    function handleCanvasMouseDown(e) {
      if (e.target !== canvas) return;
      canvasDrag.dragging = true;
      canvasDrag.startX = e.clientX;
      canvasDrag.startY = e.clientY;
      canvasDrag.origScrollLeft = canvasContainer.scrollLeft;
      canvasDrag.origScrollTop = canvasContainer.scrollTop;
      document.addEventListener('mousemove', handleCanvasMouseMove);
      document.addEventListener('mouseup', handleCanvasMouseUp);
      document.body.style.userSelect = 'none';
    }

    function handleCanvasMouseMove(e) {
      if (!canvasDrag.dragging) return;
      const dx = e.clientX - canvasDrag.startX;
      const dy = e.clientY - canvasDrag.startY;
      canvasContainer.scrollLeft = canvasDrag.origScrollLeft - dx;
      canvasContainer.scrollTop = canvasDrag.origScrollTop - dy;
    }

    function handleCanvasMouseUp() {
      canvasDrag.dragging = false;
      document.removeEventListener('mousemove', handleCanvasMouseMove);
      document.removeEventListener('mouseup', handleCanvasMouseUp);
      document.body.style.userSelect = '';
    }

    // --- Zoom Logic ---
    function handleWheel(e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      setCanvasZoom(zoom + delta, e.clientX, e.clientY);
    }

    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setCanvasZoom(zoom + ZOOM_STEP);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        setCanvasZoom(zoom - ZOOM_STEP);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setCanvasZoom(1.0);
      }
    }

    canvas.addEventListener('dblclick', handleDblClick);
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    setTimeout(() => {
      setCanvasZoom(1.0);
      if (canvasContainer) {
        canvasContainer.scrollLeft = 2500 - canvasContainer.clientWidth / 2;
        canvasContainer.scrollTop = 2500 - canvasContainer.clientHeight / 2;
      }
    }, 0);

    updateZoomIndicator();

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        containerRef.current.classList.remove('collab-canvas-root');
      }
      document.head.removeChild(style);
      canvas?.removeEventListener('dblclick', handleDblClick);
      canvas?.removeEventListener('mousedown', handleCanvasMouseDown);
      canvas?.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleCanvasMouseMove);
      document.removeEventListener('mouseup', handleCanvasMouseUp);
      document.body.style.userSelect = '';
      unsubscribe && unsubscribe();
    };
  }, [user]);

  return (
    <div ref={containerRef} />
  );
};

export default CollaborativeCanvas;
