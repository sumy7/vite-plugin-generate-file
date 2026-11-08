const mode = document.querySelector<HTMLParagraphElement>('#mode')!
mode.textContent = import.meta.env.DEV
  ? 'Files are served by the development middleware without being written to disk.'
  : 'Files are generated in the build output and served by the preview server.'
