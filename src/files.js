export function fileBase(resume) {
  const n = (resume.personal.name || resume.name || 'Resume').trim().toLowerCase().replace(/(^|\s)\S/g, (s) => s.toUpperCase());
  return n.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') + '_Resume';
}

export function saveBlob(data, filename, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

