// This file contains the content script that interacts with the LinkedIn web page.
// It accesses the DOM to fill in the necessary fields automatically based on predefined data.

const predefinedData = {
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "123-456-7890",
    jobTitle: "Software Engineer",
    company: "Tech Company",
    location: "San Francisco, CA"
};

// Zorunlu alanları bulan fonksiyon
function findRequiredFields() {
    const requiredFields = [];
    const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
    
    inputs.forEach(input => {
        let isRequired = false;
        let fieldLabel = '';
        
        // 1. HTML required attribute kontrolü
        if (input.hasAttribute('required') || input.getAttribute('aria-required') === 'true') {
            isRequired = true;
        }
        
        // 2. * işareti kontrolü - farklı yöntemlerle
        const parentElement = input.closest('div, fieldset, label, .form-group, .field, .input-group');
        if (parentElement) {
            const parentText = parentElement.textContent || '';
            if (parentText.includes('*')) {
                isRequired = true;
            }
        }
        
        // 3. Label kontrolü
        const labelElement = input.closest('label') || 
                           document.querySelector(`label[for="${input.id}"]`) ||
                           input.previousElementSibling ||
                           input.nextElementSibling;
        
        if (labelElement && (labelElement.textContent || '').includes('*')) {
            isRequired = true;
        }
        
        // 4. Placeholder veya aria-label kontrolü
        const placeholder = input.getAttribute('placeholder') || '';
        const ariaLabel = input.getAttribute('aria-label') || '';
        if (placeholder.includes('*') || ariaLabel.includes('*')) {
            isRequired = true;
        }
        
        // Alan etiketini belirle
        if (labelElement && labelElement.textContent) {
            fieldLabel = labelElement.textContent.replace('*', '').trim();
        } else if (placeholder) {
            fieldLabel = placeholder.replace('*', '').trim();
        } else if (ariaLabel) {
            fieldLabel = ariaLabel.replace('*', '').trim();
        } else if (input.name) {
            fieldLabel = input.name;
        } else if (input.id) {
            fieldLabel = input.id;
        } else {
            fieldLabel = input.type || 'Unknown Field';
        }
        
        if (isRequired && fieldLabel) {
            requiredFields.push({
                label: fieldLabel,
                type: input.type || input.tagName.toLowerCase(),
                name: input.name || '',
                id: input.id || '',
                placeholder: placeholder,
                value: input.value || '',
                isEmpty: !input.value || input.value.trim() === ''
            });
        }
    });
    
    return requiredFields;
}

// Akıllı form doldurma fonksiyonu
function smartFillForm(info) {
    const inputs = Array.from(document.querySelectorAll('input, textarea'));
    // Ad alanı için hem tek hem çift input desteği
    if (info.name) {
        const nameParts = info.name.trim().split(/\s+/);
        // 1. Önce first/last name inputlarını bul
        let firstNameInput = null, lastNameInput = null, fullNameInput = null;
        inputs.forEach(input => {
            const attrs = [input.name, input.id, input.getAttribute('aria-label'), input.getAttribute('placeholder')].join(' ').toLowerCase();
            if (!firstNameInput && /(first.*name|ad|isim)/.test(attrs)) firstNameInput = input;
            if (!lastNameInput && /(last.*name|soyad)/.test(attrs)) lastNameInput = input;
            if (!fullNameInput && /(full.*name|ad soyad|adınız soyadınız|ad ve soyad)/.test(attrs)) fullNameInput = input;
        });
        if (firstNameInput && lastNameInput) {
            firstNameInput.value = nameParts[0] || '';
            firstNameInput.dispatchEvent(new Event('input', { bubbles: true }));
            lastNameInput.value = nameParts.slice(1).join(' ') || '';
            lastNameInput.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (fullNameInput) {
            fullNameInput.value = info.name;
            fullNameInput.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            // Hiçbiri yoksa, ad geçen ilk inputa yaz
            const genericNameInput = inputs.find(input => /(name|ad|isim)/.test((input.name+input.id+input.getAttribute('aria-label')+input.getAttribute('placeholder')||'').toLowerCase()));
            if (genericNameInput) {
                genericNameInput.value = info.name;
                genericNameInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }
    // E-posta
    if (info.email) {
        const emailInput = inputs.find(input => /(mail)/.test((input.name+input.id+input.getAttribute('aria-label')+input.getAttribute('placeholder')||'').toLowerCase()));
        if (emailInput) {
            emailInput.value = info.email;
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    // Telefon
    if (info.phone) {
        const phoneInput = inputs.find(input => /(phone|tel|gsm|telefon)/.test((input.name+input.id+input.getAttribute('aria-label')+input.getAttribute('placeholder')||'').toLowerCase()));
        if (phoneInput) {
            phoneInput.value = info.phone;
            phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    // LinkedIn URL
    if (info.linkedin) {
        const linkedinInput = inputs.find(input => /(linkedin|profile|profil)/i.test((input.name + input.id + input.getAttribute('aria-label') + input.getAttribute('placeholder') || '').toLowerCase()));
        if (linkedinInput) {
            linkedinInput.value = info.linkedin;
            linkedinInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    // Current Company
    if (info.company) {
        const companyInput = inputs.find(input => /(company|şirket|firma|kurum)/i.test((input.name + input.id + input.getAttribute('aria-label') + input.getAttribute('placeholder') || '').toLowerCase()));
        if (companyInput) {
            companyInput.value = info.company;
            companyInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
}

// CV dosyasını otomatik yükle (Global kapsamda tanımlanmalı)
function uploadCVFile(fileData, fileName) {
    // input[type=file] olan ve label'ında veya placeholder'ında cv, resume, özgeçmiş geçen inputu bul
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
    let bestInput = null;
    fileInputs.forEach(input => {
        const label = (input.getAttribute('aria-label') || '') + ' ' + (input.getAttribute('placeholder') || '') + ' ' + (input.name || '') + ' ' + (input.id || '');
        if (/cv|resume|özgeçmiş/i.test(label)) {
            bestInput = input;
        }
    });
    if (!bestInput && fileInputs.length > 0) bestInput = fileInputs[0]; // Eğer özel bir input bulunamazsa ilk file input'u kullan
    if (bestInput) {
        // FileList ve File nesnesi oluştur
        const dt = new DataTransfer();
        const file = new File([fileData], fileName, { type: 'application/pdf' }); // MIME type eklendi
        dt.items.add(file);
        bestInput.files = dt.files;
        bestInput.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('CV dosyası başarıyla yüklendi:', fileName);
    } else {
        console.error('CV yüklemek için uygun bir dosya giriş alanı bulunamadı.');
    }
}

// Okunan bilgileri formun altına yazan fonksiyon (artık globalde)
function showExtractedInfoOnPage(info) {
    let infoDiv = document.getElementById('auto-fill-extracted-info');
    if (!infoDiv) {
        infoDiv = document.createElement('div');
        infoDiv.id = 'auto-fill-extracted-info';
        infoDiv.style = 'margin: 20px 0; padding: 10px; background: #f3f3f3; border: 1px solid #ccc; color: #222; font-size: 14px;';
        document.body.appendChild(infoDiv);
    }
    infoDiv.innerHTML =
        `<b>Ad:</b> ${info.name || '-'}<br>` +
        `<b>E-posta:</b> ${info.email || '-'}<br>` +
        `<b>Telefon:</b> ${info.phone || '-'}<br>` +
        `<b>LinkedIn:</b> ${info.linkedin || '-'}<br>` +
        `<b>Şirket:</b> ${info.company || '-'}<br>`;
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'ping') {
        // Content script'in hazır olduğunu bildiren ping cevabı
        sendResponse({ status: 'ready' });
        return true;
    }
    if (request.action === 'findRequiredFields') {
        // Zorunlu alanları bul ve gönder
        const requiredFields = findRequiredFields();
        sendResponse({ requiredFields: requiredFields });
        return true;
    }
    if (request.action === 'fillForm' && request.data) {
        smartFillForm(request.data);
        sendResponse({ status: 'form_filled' });
        return true;
    }
    if (request.action === 'uploadCV' && request.fileData && request.fileName) {
        // fileData base64 string, fileName string
        const byteCharacters = atob(request.fileData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        uploadCVFile(byteArray, request.fileName);
        sendResponse({ status: 'cv_uploaded' });
        return true;
    }
});