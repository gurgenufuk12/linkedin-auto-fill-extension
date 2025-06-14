if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '../libs/pdf.worker.js'; // UMD version of worker
    console.log('PDF.js worker, mevcut pdfjsLib kullanılarak yapılandırıldı.');
} else if (typeof pdfjsDistBuildPdf !== 'undefined') {
    window.pdfjsLib = pdfjsDistBuildPdf; // Fallback
    if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '../libs/pdf.worker.js';
        console.log('PDF.js worker, pdfjsDistBuildPdf kullanılarak yapılandırıldı.');
    } else {
        console.error('pdfjsLib, pdfjsDistBuildPdf üzerinden atandı ancak GlobalWorkerOptions eksik. Worker yapılandırılamadı.');
    }
} else {
    console.error('pdfjsLib tanımlı değil. PDF işlevleri çalışmayacak. popup-init.js\'den önce pdf.min.js (UMD sürümü) yüklendiğinden emin olun.');
}
