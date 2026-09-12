import './style.css';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

// ==========================================
// Firebase設定
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCJ4cC0F-xxJnCUa4BLCGemxrWEZdZsX_4",
  authDomain: "iraisyo-140a8.firebaseapp.com",
  projectId: "iraisyo-140a8",
  storageBucket: "iraisyo-140a8.firebasestorage.app",
  messagingSenderId: "571592267447",
  appId: "1:571592267447:web:ab31e5632b28a6feee5f32",
  measurementId: "G-LHZEEBSEJK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// 状態管理
let currentDate = new Date();
let allPdfs = [];
let selectedDateStr = '';

// DOM要素
const monthTitle = document.getElementById('month-title');
const calendarGrid = document.getElementById('calendar-grid');
const modal = document.getElementById('modal');
const modalDateTitle = document.getElementById('modal-date-title');
const pdfItems = document.getElementById('pdf-items');
const pdfForm = document.getElementById('pdf-form');
const previewModal = document.getElementById('preview-modal');
const pdfIframe = document.getElementById('pdf-iframe');

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  fetchPdfs();
  setupEventListeners();
});

async function fetchPdfs() {
  const querySnapshot = await getDocs(collection(db, "pdfs"));
  allPdfs = [];
  querySnapshot.forEach((docSnap) => {
    allPdfs.push({ id: docSnap.id, ...docSnap.data() });
  });
  renderCalendar();
}

function renderCalendar() {
  calendarGrid.innerHTML = '';
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  monthTitle.textContent = `${year}年 ${month + 1}月`;

  // 曜日のヘッダー
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  weekDays.forEach(day => {
    const div = document.createElement('div');
    div.className = 'calendar-day header-label';
    div.textContent = day;
    calendarGrid.appendChild(div);
  });

  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();

  // 空白セル
  for (let i = 0; i < firstDayIndex; i++) {
    const div = document.createElement('div');
    div.className = 'calendar-day';
    div.style.background = '#f9f9f9';
    calendarGrid.appendChild(div);
  }

  // 日付セル
  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const div = document.createElement('div');
    div.className = 'calendar-day';
    
    const dayNum = document.createElement('div');
    dayNum.className = 'day-number';
    dayNum.textContent = day;
    div.appendChild(dayNum);

    // 該当日のPDFをフィルタ
    const matchedPdfs = allPdfs.filter(p => p.date === dateStr);
    if (matchedPdfs.length > 0) {
      const indicator = document.createElement('div');
      indicator.className = 'indicator';
      indicator.textContent = `${matchedPdfs.length}件`;
      div.appendChild(indicator);
    }

    div.addEventListener('click', () => openModal(dateStr, matchedPdfs));
    calendarGrid.appendChild(div);
  }
}

function openModal(dateStr, pdfs) {
  selectedDateStr = dateStr;
  modalDateTitle.textContent = `${dateStr} のPDF管理`;
  document.getElementById('edit-id').value = '';
  pdfForm.reset();
  document.getElementById('save-btn').textContent = '登録する';
  
  renderPdfList(pdfs);
  modal.style.display = 'flex';
}

function renderPdfList(pdfs) {
  pdfItems.innerHTML = '';
  if (pdfs.length === 0) {
    pdfItems.innerHTML = '<p>登録されたPDFはありません。</p>';
    return;
  }

  pdfs.forEach(pdf => {
    const item = document.createElement('div');
    item.className = 'pdf-item-card';
    item.innerHTML = `
      <div class="pdf-item-info">
        <strong>地名: ${pdf.location} | 企業: ${pdf.company}</strong><br>
        <small>${pdf.name ? '個人: ' + pdf.name : ''}</small>
      </div>
      <div class="pdf-actions">
        <button type="button" class="preview-btn">表示</button>
        <button type="button" class="edit-btn">編集</button>
        <button type="button" class="delete-btn">削除</button>
      </div>
    `;

    item.querySelector('.preview-btn').addEventListener('click', () => {
      pdfIframe.src = pdf.fileUrl;
      previewModal.style.display = 'flex';
    });

    item.querySelector('.edit-btn').addEventListener('click', () => {
      document.getElementById('edit-id').value = pdf.id;
      document.getElementById('input-location').value = pdf.location;
      document.getElementById('input-company').value = pdf.company;
      document.getElementById('input-name').value = pdf.name || '';
      document.getElementById('save-btn').textContent = '更新する';
    });

    item.querySelector('.delete-btn').addEventListener('click', async () => {
      if (confirm('本当に削除しますか？')) {
        await deleteDoc(doc(db, "pdfs", pdf.id));
        if (pdf.filePath) {
          const fileRef = ref(storage, pdf.filePath);
          await deleteObject(fileRef).catch(() => {});
        }
        await fetchPdfs();
        modal.style.display = 'none';
      }
    });

    pdfItems.appendChild(item);
  });
}

// フォーム送信（登録・編集）
pdfForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = document.getElementById('edit-id').value;
  const location = document.getElementById('input-location').value;
  const company = document.getElementById('input-company').value;
  const name = document.getElementById('input-name').value;
  const fileInput = document.getElementById('input-file');

  let fileUrl = '';
  let filePath = '';

  if (fileInput.files[0]) {
    const file = fileInput.files[0];
    filePath = `pdfs/${Date.now()}_${file.name}`;
    const fileRef = ref(storage, filePath);
    const snapshot = await uploadBytes(fileRef, file);
    fileUrl = await getDownloadURL(snapshot.ref);
  }

  if (editId) {
    // 編集
    const updateData = { location, company, name };
    if (fileUrl) {
      updateData.fileUrl = fileUrl;
      updateData.filePath = filePath;
    }
    await updateDoc(doc(db, "pdfs", editId), updateData);
  } else {
    // 新規登録
    if (!fileUrl) {
      alert('PDFファイルを選択してください。');
      return;
    }
    await addDoc(collection(db, "pdfs"), {
      date: selectedDateStr,
      location,
      company,
      name,
      fileUrl,
      filePath,
      createdAt: new Date()
    });
  }

  pdfForm.reset();
  await fetchPdfs();
  modal.style.display = 'none';
});

function setupEventListeners() {
  document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  document.getElementById('close-modal').addEventListener('click', () => modal.style.display = 'none');
  document.getElementById('close-preview').addEventListener('click', () => {
    previewModal.style.display = 'none';
    pdfIframe.src = '';
  });

  // 検索処理
  document.getElementById('search-btn').addEventListener('click', () => {
    const keyword = document.getElementById('search-input').value.toLowerCase().trim();
    if (!keyword) return;

    const filtered = allPdfs.filter(p => 
      (p.location && p.location.toLowerCase().includes(keyword)) ||
      (p.company && p.company.toLowerCase().includes(keyword)) ||
      (p.name && p.name.toLowerCase().includes(keyword))
    );

    calendarGrid.innerHTML = '';
    monthTitle.textContent = `検索結果: "${keyword}" (${filtered.length}件)`;

    if (filtered.length === 0) {
      calendarGrid.innerHTML = '<p style="grid-column: span 7; text-align: center; padding: 20px;">一致するデータが見つかりませんでした。</p>';
    } else {
      const matchedDates = [...new Set(filtered.map(p => p.date))];
      matchedDates.forEach(dateStr => {
        const div = document.createElement('div');
        div.className = 'calendar-day';
        div.style.minHeight = '80px';
        
        const dayNum = document.createElement('div');
        dayNum.className = 'day-number';
        dayNum.textContent = dateStr;
        div.appendChild(dayNum);

        const matchedPdfs = filtered.filter(p => p.date === dateStr);
        const indicator = document.createElement('div');
        indicator.className = 'indicator';
        indicator.textContent = `${matchedPdfs.length}件`;
        div.appendChild(indicator);

        div.addEventListener('click', () => openModal(dateStr, matchedPdfs));
        calendarGrid.appendChild(div);
      });
    }

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.style.display = 'inline-block';
  });

  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      document.getElementById('search-input').value = '';
      resetBtn.style.display = 'none';
      renderCalendar();
    });
  }
}