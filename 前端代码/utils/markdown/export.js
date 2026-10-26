/**
 * 直接导出 Markdown 文本为文件
 * @param {string} markdownText - Markdown 文本内容
 * @param {string} fileName - 文件名（不含扩展名）
 */
const exportMarkdownText = (markdownText, fileName = 'document') => {
  try {
    const blob = new Blob([markdownText], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, `${fileName}.md`);
    
    return { success: true, message: '导出成功' };
  } catch (error) {
    console.error('导出 Markdown 失败:', error);
    return { success: false, message: error.message };
  }
};


/**
 * 下载 Blob 对象
 * @param {Blob} blob - Blob 对象
 * @param {string} fileName - 文件名
 */
const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};


export { 
  exportMarkdownText,
  downloadBlob 
};

