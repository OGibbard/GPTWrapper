import React, { useEffect, useRef } from 'react';
// Add these imports for Firestore
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { auth } from './firebaseConfig';
// Add this import:
import { updateProfile } from "firebase/auth";

const CollaborativeCanvas = ({ user }) => {
  const containerRef = useRef(null);

  // Helper to get display name or fallback to uid
  function getDisplayName(user) {
    return user.displayName || user.email || user.uid;
  }

  useEffect(() => {
    if (!containerRef.current || !user) return;

    // Print all user display names from Firebase Auth (requires admin privileges or REST API for all users)
    // In client-side code, you can only access the current user's display name.
    // For demonstration, print the current user's display name:
    console.log("Current user display name:", user.displayName);

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
        width: 14000px;
        height: 7000px;
        position: absolute;
        top: 0;
        left: 0;
        cursor: pointer;
        z-index: 1; /* background */
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
        z-index: 10; /* ensure above background */
      }
      .textbox:focus-within,
      .textbox.selected {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }
      .textbox-delete {
        display: none;
        position: absolute;
        top: 4px;
        right: 4px;
        background: #fffbe9;
        border: 1px solid #facc15;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        font-size: 1.1rem;
        color: #e11d48;
        cursor: pointer;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 4px 0 rgb(0 0 0 / 0.07);
        z-index: 20;
        transition: background 0.15s;
      }
      .textbox:focus-within .textbox-delete,
      .textbox.selected .textbox-delete {
        display: flex;
      }
      .textbox-delete:hover {
        background: #fde68a;
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
        font-family: 'Inter', sans-serif;
      }
      .canvas-header-bar .desc {
        font-size: 1rem;
        color: #64748b;
        font-family: 'Inter', sans-serif;
      }
      .canvas-header-bar .zoom {
        font-size: 0.95rem;
        color: #334155;
        background: #f1f5f9;
        border-radius: 8px;
        padding: 2px 10px;
        margin-left: 8px;
        font-family: 'Inter', sans-serif;
      }
      .canvas-header-bar .userid {
        font-size: 0.85rem;
        color: #64748b;
        background: #f1f5f9;
        border-radius: 8px;
        padding: 2px 10px;
        margin-left: 8px;
        font-family: 'Inter', sans-serif;
      }
      /* Settings menu font */
      #settings-menu,
      #settings-menu * {
        font-family: 'Inter', sans-serif !important;
      }
      #settings-menu {
        min-width: 220px !important;
        min-height: 140px !important;
        padding-bottom: 32px !important;
        /* Match header bar style */
        background: rgba(255,255,255,0.85);
        border: 1.5px solid rgba(120,120,120,0.18); /* slightly fading grey border */
        border-radius: 12px;
        box-shadow: 0 2px 8px 0 rgb(0 0 0 / 0.04);
        z-index: 200;
        padding: 14px;
        position: absolute;
        top: 110%;
        left: 0;
        display: none;
      }
      .userid-dropdown {
        cursor: pointer;
        position: relative;
      }
      /* Move save/cancel buttons slightly lower */
      #display-name-form {
        display: none;
        margin-top: 10px;
      }
      #display-name-form .display-name-actions {
        display: flex;
        flex-direction: row;
        margin-top: 10px;
      }
    `;
    document.head.appendChild(style);

    containerRef.current.innerHTML = `
      <div class="canvas-header-overlay">
        <div class="canvas-header-bar">
          <span class="title">Collaborative Canvas</span>
          <span class="desc">Double-click to add a note.</span>
          <span id="zoom-indicator" class="zoom">Zoom: 100%</span>
          <span id="notes-counter" class="zoom" style="cursor:pointer;position:relative;">
            Notes: <span id="notes-count-value">0</span>
            <svg width="14" height="14" style="margin-left:2px;vertical-align:middle;" viewBox="0 0 20 20" fill="none">
              <path d="M6 8l4 4 4-4" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div id="notes-dropdown-list" style="display:none;position:absolute;top:110%;left:0;min-width:220px;max-height:300px;overflow:auto;background:#fffbe9;border:1px solid #facc15;border-radius:8px;box-shadow:0 2px 8px 0 rgb(0 0 0 / 0.08);z-index:100;">
              <!-- Notes will be injected here -->
            </div>
          </span>
          <span class="userid userid-dropdown" id="user-dropdown" style="font-size:0.85rem;color:#64748b;background:#f1f5f9;border-radius:8px;padding:2px 10px;margin-left:8px;font-family:'Inter',sans-serif;cursor:pointer;position:relative;">
            User: <span id="user-id-display"></span>
            <svg width="14" height="14" style="margin-left:2px;vertical-align:middle;" viewBox="0 0 20 20" fill="none">
              <path d="M6 8l4 4 4-4" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div id="settings-menu">
              <div style="font-weight:bold;color:#334155;margin-bottom:8px;">Settings</div>
              <div style="margin-bottom:12px;">
                <span style="color:#64748b;font-size:0.97rem;">Display Name:</span>
                <span id="current-display-name" style="margin-left:8px;font-size:0.97rem;color:#64748b;font-weight:normal;"></span>
              </div>
              <button id="change-display-name-btn" style="background:#f1f5f9;border:none;border-radius:8px;padding:2px 10px;font-size:1rem;cursor:pointer;color:#334155;margin-top:2px;">
                Change Display Name
              </button>
              <div id="display-name-form" style="display:none;margin-top:10px;">
                <input id="display-name-input" type="text" maxlength="40" style="padding:5px 8px;border:1px solid #facc15;border-radius:5px;width:140px;font-size:1rem;" />
                <div class="display-name-actions" style="margin-top:10px;">
                  <button id="save-display-name-btn" style="background:#222;color:#fff;border:none;border-radius:5px;padding:5px 12px;font-size:1rem;cursor:pointer;">Save</button>
                  <button id="cancel-display-name-btn" style="margin-left:4px;background:#f1f5f9;color:#334155;border:none;border-radius:5px;padding:5px 12px;font-size:1rem;cursor:pointer;">Cancel</button>
                </div>
              </div>
            </div>
          </span>
        </div>
      </div>
      <div id="canvas-container">
        <div id="canvas-bg"></div>
      </div>
    `;

    // Set user display name
    const userIdDisplay = containerRef.current.querySelector('#user-id-display');
    if (userIdDisplay && user) {
      userIdDisplay.textContent = getDisplayName(user);
    }

    // Settings menu logic (now on user dropdown)
    const userDropdown = containerRef.current.querySelector('#user-dropdown');
    const settingsMenu = containerRef.current.querySelector('#settings-menu');
    const currentDisplayName = containerRef.current.querySelector('#current-display-name');
    const changeDisplayNameBtn = containerRef.current.querySelector('#change-display-name-btn');
    const displayNameForm = containerRef.current.querySelector('#display-name-form');
    const displayNameInput = containerRef.current.querySelector('#display-name-input');
    const saveDisplayNameBtn = containerRef.current.querySelector('#save-display-name-btn');
    const cancelDisplayNameBtn = containerRef.current.querySelector('#cancel-display-name-btn');

    if (currentDisplayName && user) {
      currentDisplayName.textContent = getDisplayName(user);
    }

    // Track menu open state to avoid toggling form on every click
    let settingsMenuOpen = false;

    userDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      // Only toggle menu if click is not inside the settings menu or its children
      if (!settingsMenu.contains(e.target)) {
        settingsMenuOpen = !settingsMenuOpen;
        settingsMenu.style.display = settingsMenuOpen ? 'block' : 'none';
        displayNameForm.style.display = 'none';
        displayNameInput.value = '';
      }
    });

    // Hide settings menu on outside click
    document.addEventListener('mousedown', (e) => {
      if (
        settingsMenu.style.display === 'block' &&
        !settingsMenu.contains(e.target) &&
        !userDropdown.contains(e.target)
      ) {
        settingsMenu.style.display = 'none';
        displayNameForm.style.display = 'none';
        settingsMenuOpen = false;
      }
    });

    // Display name change logic
    changeDisplayNameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      displayNameForm.style.display = 'block';
      displayNameInput.value = user.displayName || '';
      displayNameInput.focus();
    });
    cancelDisplayNameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      displayNameForm.style.display = 'none';
      displayNameInput.value = '';
    });
    saveDisplayNameBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newName = displayNameInput.value.trim();
      if (!newName) return;
      // Update Firebase Auth displayName
      if (auth.currentUser && auth.currentUser.uid === user.uid) {
        await updateProfile(auth.currentUser, { displayName: newName });
        // Update UI
        user.displayName = newName;
        if (userIdDisplay) userIdDisplay.textContent = newName;
        if (currentDisplayName) currentDisplayName.textContent = newName;
        displayNameForm.style.display = 'none';
        settingsMenu.style.display = 'none';
        settingsMenuOpen = false;
      }
    });

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
    const notesCounter = containerRef.current.querySelector('#notes-counter');
    const notesCountValue = containerRef.current.querySelector('#notes-count-value');
    const notesDropdownList = containerRef.current.querySelector('#notes-dropdown-list');
    let notesList = []; // [{id, text, x, y}]
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
    const ZOOM_STEP = 0.05; // Increased from 0.01 to 0.05 for more sensitivity

    function updateZoomIndicator() {
      if (zoomIndicator) {
        zoomIndicator.textContent = `Zoom: ${Math.round(zoom * 100)}%`;
      }
    }

    function setCanvasZoom(newZoom, centerX, centerY) {
      // Only update zoom if it actually changes
      if (Math.abs(zoom - newZoom) < 0.0001) return;
      const prevZoom = zoom;
      zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      canvas.style.transformOrigin = "0 0";
      canvas.style.transform = `scale(${zoom})`;

      // Make notes zoom at the same rate as the background
      Array.from(canvas.querySelectorAll('.textbox')).forEach(tb => {
        tb.style.transformOrigin = "0 0";
        tb.style.transform = "";
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
        textbox.style.transform = ""; // No per-textbox scaling

        // Ensure position is always set
        textbox.style.left = (typeof data.x === 'number' ? data.x : 0) + 'px';
        textbox.style.top = (typeof data.y === 'number' ? data.y : 0) + 'px';

        const content = document.createElement('div');
        content.className = 'textbox-content';
        content.contentEditable = 'true';
        content.innerText = data.text || '';

        // Delete icon
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'textbox-delete';
        deleteBtn.title = 'Delete note';
        deleteBtn.type = 'button';
        deleteBtn.innerText = '🗑️';
        deleteBtn.addEventListener('mousedown', e => e.stopPropagation());
        deleteBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          await deleteDoc(doc(textboxesCollectionRef, id));
        });

        textbox.appendChild(deleteBtn);
        textbox.appendChild(content);

        // Focus/selection logic
        content.addEventListener('focus', () => {
          textbox.classList.add('selected');
        });
        content.addEventListener('blur', () => {
          // Delay to allow click on delete button or other controls
          setTimeout(() => {
            if (!textbox.contains(document.activeElement)) {
              textbox.classList.remove('selected');
            }
          }, 0);
        });
        textbox.addEventListener('mousedown', (ev) => {
          // Prevent zooming or scroll jumps when clicking a note on the canvas
          // Only add 'selected' class, do not call setCanvasZoom or scroll
          textbox.classList.add('selected');
        });

        // Save text on blur
        content.addEventListener('blur', async () => {
          await setDoc(doc(textboxesCollectionRef, id), {
            ...data,
            text: content.innerText,
            x: parseFloat(textbox.style.left),
            y: parseFloat(textbox.style.top),
            lastModified: serverTimestamp()
          }, { merge: true });
        });

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

        // Right-click to delete (keep for convenience)
        textbox.addEventListener('contextmenu', async (ev) => {
          ev.preventDefault();
          await deleteDoc(doc(textboxesCollectionRef, id));
        });

        canvas.appendChild(textbox);
      }
      // Always update position and text to match Firestore
      textbox.style.left = (typeof data.x === 'number' ? data.x : 0) + 'px';
      textbox.style.top = (typeof data.y === 'number' ? data.y : 0) + 'px';
      textbox.style.transform = ""; // No per-textbox scaling
      const content = textbox.querySelector('.textbox-content');
      if (content && content.innerText !== data.text) {
        content.innerText = data.text;
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
      notesList = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        renderTextbox(docSnap.id, data);
        notesList.push({ id: docSnap.id, ...data });
      });
      // Sort by most recent (descending by lastModified)
      notesList.sort((a, b) => {
        const aTime = a.lastModified?.toMillis ? a.lastModified.toMillis() : 0;
        const bTime = b.lastModified?.toMillis ? b.lastModified.toMillis() : 0;
        return bTime - aTime;
      });
      renderNotesDropdown();
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
        createdAt: serverTimestamp(),
        lastModified: serverTimestamp()
      });
    }

    function handleDrag(ev) {
      if (!dragState.dragging || !dragState.target) return;
      // Use canvasContainer's bounding rect for correct coordinates
      const containerRect = canvasContainer.getBoundingClientRect();
      let x = (ev.clientX - containerRect.left + canvasContainer.scrollLeft) / zoom - dragState.offsetX;
      let y = (ev.clientY - containerRect.top + canvasContainer.scrollTop) / zoom - dragState.offsetY;
      // Update max bounds to match canvas-bg size (14000x7000)
      x = Math.max(0, Math.min(x, 14000 - dragState.target.offsetWidth));
      y = Math.max(0, Math.min(y, 7000 - dragState.target.offsetHeight));
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
          lastModified: serverTimestamp()
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

    // Dropdown logic
    notesCounter.addEventListener('click', (e) => {
      e.stopPropagation();
      notesDropdownList.style.display = notesDropdownList.style.display === 'block' ? 'none' : 'block';
    });
    // Hide dropdown on outside click
    document.addEventListener('mousedown', (e) => {
      if (!notesDropdownList.contains(e.target) && e.target !== notesCounter) {
        notesDropdownList.style.display = 'none';
      }
    });

    function renderNotesDropdown() {
      notesDropdownList.innerHTML = '';
      notesCountValue.textContent = notesList.length;
      if (notesList.length === 0) {
        const empty = document.createElement('div');
        empty.style.padding = '10px';
        empty.style.color = '#64748b';
        empty.textContent = 'No notes';
        notesDropdownList.appendChild(empty);
        return;
      }
      notesList.forEach(note => {
        const item = document.createElement('div');
        item.style.padding = '8px 12px';
        item.style.cursor = 'pointer';
        item.style.whiteSpace = 'nowrap';
        item.style.overflow = 'hidden';
        item.style.textOverflow = 'ellipsis';
        item.style.fontSize = '1rem';
        item.style.borderBottom = '1px solid #fde68a';
        item.textContent = (note.text || 'Untitled').split('\n')[0].slice(0, 40);
        item.title = note.text || 'Untitled';
        item.addEventListener('click', () => {
          notesDropdownList.style.display = 'none';
          // Only zoom if not already at 200% (allow for floating point error)
          if (Math.abs(zoom - 2.0) > 0.01) {
            setCanvasZoom(2.0);
            // Wait for zoom to apply before scrolling (next tick)
            setTimeout(() => scrollToNote(note), 0);
          } else {
            scrollToNote(note);
          }
        });
        notesDropdownList.appendChild(item);
      });
    }

    function scrollToNote(note) {
      // Center the canvasContainer on the note
      if (!canvasContainer) return;
      const noteX = note.x ?? 0;
      const noteY = note.y ?? 0;
      const noteWidth = 200; // Approximate width
      const noteHeight = 100; // Approximate height
      const centerX = noteX + noteWidth / 2;
      const centerY = noteY + noteHeight / 2;
      canvasContainer.scrollLeft = centerX * zoom - canvasContainer.clientWidth / 2;
      canvasContainer.scrollTop = centerY * zoom - canvasContainer.clientHeight / 2;
    }

    canvas.addEventListener('dblclick', handleDblClick);
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    // Deselect all notes when clicking on the canvas background
    canvas.addEventListener('mousedown', (e) => {
      if (e.target === canvas) {
        Array.from(canvas.querySelectorAll('.textbox.selected')).forEach(tb => {
          tb.classList.remove('selected');
        });
      }
    });

    setTimeout(() => {
      setCanvasZoom(1.0);
      if (canvasContainer && canvas) {
        // Center the canvas on the middle of the background
        // Use the background size (matches #canvas-bg)
        const bgWidth = 14000;
        const bgHeight = 7000;
        canvasContainer.scrollLeft = (bgWidth / 2) - (canvasContainer.clientWidth / 2);
        canvasContainer.scrollTop = (bgHeight / 2) - (canvasContainer.clientHeight / 2);
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

/*
User info and notes storage:

- User info (such as user.uid) comes from Firebase Authentication and is not stored in Firestore by this component.
- Notes are stored in Firestore under the following path:

  artifacts/collaborative-canvas/users/{userId}/textboxes/{textboxId}

  Each note (textbox) is a document in the 'textboxes' subcollection for the authenticated user.
  The document contains fields like: text, x, y, createdAt, lastModified.

- Example Firestore structure:
  artifacts
    └── collaborative-canvas
        └── users
            └── {userId}
                └── textboxes
                    └── {textboxId}
                        ├── text
                        ├── x
                        ├── y
                        ├── createdAt
                        └── lastModified

- No additional user profile info is stored in Firestore by this code.

- Display names are stored in Firebase Authentication as part of the user profile (user.displayName).
- They are NOT stored in Firestore by this component.
- If you want to share display names with other users or persist them in Firestore, you must explicitly write them to a Firestore collection.
*/

// User profiles (such as display names) are NOT stored in Firestore by this component.
// You will NOT see user profiles in Firestore unless you explicitly write them to a Firestore collection (e.g., users/{userId}).
// All user profile info (displayName, email, etc.) is managed by Firebase Authentication and can be viewed in the Firebase Console under "Authentication" > "Users".
// Firestore only contains notes under artifacts/collaborative-canvas/users/{userId}/textboxes/...

export default CollaborativeCanvas;
