const DB_NAME = 'file_manager_upload_cache'
const DB_VERSION = 2
const STORE = 'upload_records'

let _dbPromise = null

function openDb() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('file_hash', 'file_hash', { unique: false })
        store.createIndex('folder_id', 'folder_id', { unique: false })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('created_at', 'created_at', { unique: false })
      }
      if (e.oldVersion < 2) {
        const store = e.target.transaction.objectStore(STORE)
        if (!store.indexNames.contains('upload_type')) {
          store.createIndex('upload_type', 'upload_type', { unique: false })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
  return _dbPromise
}

export async function initDB() {
  await openDb()
}

export function generateRecordId(fileHash, folderId) {
  return `${fileHash}_${folderId}`
}

export async function saveUploadRecord(record) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).put({
      ...record,
      updated_at: Date.now()
    })
  })
}

export async function getUploadRecord(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export function isFolderUploadRecordComplete(record) {
  if (!record?.file_metadata_list?.length) return false
  return record.file_metadata_list.every(m => m.uploaded || m.skipped)
}

export async function getIncompleteRecords() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.getAll()
    req.onsuccess = () => {
      const all = req.result ?? []
      resolve(all.filter(r => {
        if (r.status === 'completed') return false
        if (r.file_hash === 'folder_upload' && isFolderUploadRecordComplete(r)) return false
        return true
      }))
    }
    req.onerror = () => reject(req.error)
  })
}

/** 清理已全部上传/跳过的文件夹上传缓存，避免刷新后误报未完成任务 */
export async function pruneCompletedUploadRecords() {
  const db = await openDb()
  const records = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result ?? [])
    req.onerror = () => reject(req.error)
  })
  const toDelete = records.filter(r => (
    r.file_hash === 'folder_upload' && isFolderUploadRecordComplete(r)
  ))
  if (toDelete.length === 0) return 0
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    const store = tx.objectStore(STORE)
    toDelete.forEach(r => store.delete(r.id))
  })
  return toDelete.length
}

export async function deleteUploadRecord(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).delete(id)
  })
}

export async function deleteAllIncompleteRecords() {
  const db = await openDb()
  const records = await getIncompleteRecords()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    const store = tx.objectStore(STORE)
    records.forEach(r => store.delete(r.id))
  })
}

export async function cleanupExpiredRecords(maxAgeMs = 7 * 24 * 3600 * 1000) {
  const db = await openDb()
  const cutoff = Date.now() - maxAgeMs
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const idx = store.index('created_at')
    const range = IDBKeyRange.upperBound(cutoff)
    const req = idx.openCursor(range)
    req.onsuccess = (e) => {
      const cursor = e.target.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function detectPrivateMode() {
  try {
    await initDB()
    const testId = '__private_mode_test__'
    await saveUploadRecord({
      id: testId,
      file_hash: '',
      file_name: '',
      file_size: 0,
      folder_id: '',
      upload_type: 'whole',
      status: 'completed',
      progress: 0,
      created_at: Date.now(),
      updated_at: Date.now()
    })
    await deleteUploadRecord(testId)
    return false
  } catch {
    return true
  }
}
