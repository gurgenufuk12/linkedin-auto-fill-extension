document.addEventListener("DOMContentLoaded", function () {
  function sendCVToContentScript(file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(event.target.result))
      );
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs.length > 0 && tabs[0] && tabs[0].id != null) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "uploadCV",
              fileData: base64,
              fileName: file.name,
            },
            function (response) {
              if (chrome.runtime.lastError) {
                console.error(
                  "Error sending 'uploadCV' message to content script:",
                  chrome.runtime.lastError.message
                );
                const uploadStatus = document.getElementById("upload-status");
                if (uploadStatus) {
                  uploadStatus.textContent =
                    "Hata: Sayfa ile iletişim kurulamadı. Sayfa desteklenmiyor veya yenilenmiş olabilir.";
                  uploadStatus.style.color = "red";
                }
              } else {
              }
            }
          );
        } else {
          console.error(
            "No active tab found or tab ID is missing for sending 'uploadCV'."
          );
          const uploadStatus = document.getElementById("upload-status");
          if (uploadStatus) {
            uploadStatus.textContent =
              "Hata: Aktif sekme ile iletişim kurulamıyor.";
            uploadStatus.style.color = "red";
          }
        }
      });
    };
    reader.readAsArrayBuffer(file);
  }

  const cvForm = document.getElementById("cv-upload-form");
  const cvFileInput = document.getElementById("cv-file");
  const uploadStatus = document.getElementById("upload-status");

  const findRequiredBtn = document.getElementById("find-required-btn");
  const requiredFieldsList = document.getElementById("required-fields-list");

  findRequiredBtn.addEventListener("click", function () {
    findRequiredFields();
  });

  function findRequiredFields() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs.length > 0 && tabs[0] && tabs[0].id != null) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "findRequiredFields" },
          function (response) {
            if (chrome.runtime.lastError) {
              console.error(
                "Error finding required fields:",
                chrome.runtime.lastError.message
              );
              requiredFieldsList.innerHTML =
                '<p style="color: red;">Hata: Sayfa ile iletişim kurulamadı.</p>';
            } else if (response && response.requiredFields) {
              displayRequiredFields(response.requiredFields);
            }
          }
        );
      } else {
        requiredFieldsList.innerHTML =
          '<p style="color: red;">Hata: Aktif sekme bulunamadı.</p>';
      }
    });
  }

  function displayRequiredFields(fields) {
    if (fields.length === 0) {
      requiredFieldsList.innerHTML =
        "<p>Bu sayfada zorunlu alan bulunamadı.</p>";
      return;
    }

    let html = "<h3>Zorunlu Alanlar:</h3><ul>";
    fields.forEach((field) => {
      const status = field.isEmpty ? "❌ Boş" : "✅ Dolu";
      const statusColor = field.isEmpty ? "red" : "green";
      html += `
                <li>
                    <strong>${field.label}</strong> 
                    <span style="color: ${statusColor};">(${status})</span>
                    <br>
                    <small>Tip: ${field.type} ${
        field.name ? "| Name: " + field.name : ""
      }</small>
                    ${
                      field.value
                        ? "<br><small>Değer: " +
                          field.value.substring(0, 50) +
                          (field.value.length > 50 ? "..." : "") +
                          "</small>"
                        : ""
                    }
                </li>
            `;
    });
    html += "</ul>";

    const emptyFields = fields.filter((f) => f.isEmpty);
    if (emptyFields.length > 0) {
      html += `<p style="color: red;"><strong>${emptyFields.length}</strong> alan henüz doldurulmamış.</p>`;
    } else {
      html +=
        '<p style="color: green;"><strong>Tüm zorunlu alanlar doldurulmuş!</strong></p>';
    }

    requiredFieldsList.innerHTML = html;
  }

  cvForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const file = cvFileInput.files[0];
    if (!file) {
      uploadStatus.textContent = "Lütfen bir dosya seçin.";
      return;
    }
    uploadStatus.textContent = "CV yükleniyor...";
    sendCVToContentScript(file);

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith(".pdf")) {
      const reader = new FileReader();
      reader.onload = function (event) {
        const typedarray = new Uint8Array(event.target.result);
        pdfjsLib.getDocument({ data: typedarray }).promise.then(
          function (pdf) {
            let textPromises = [];
            for (let i = 1; i <= pdf.numPages; i++) {
              textPromises.push(
                pdf
                  .getPage(i)
                  .then((page) =>
                    page
                      .getTextContent()
                      .then((tc) => tc.items.map((item) => item.str).join(" "))
                  )
              );
            }
            Promise.all(textPromises).then((pages) => {
              const fullText = pages.join("\n");
              uploadStatus.textContent = "PDF başarıyla okundu!";
              const info = extractInfoFromText(fullText);
              setTimeout(() => {
                sendInfoToContentScript(info);
              }, 1000);
            });
          },
          function (error) {
            uploadStatus.textContent = "PDF okunamadı!";
          }
        );
      };
      reader.readAsArrayBuffer(file);
    } else if (fileName.endsWith(".docx")) {
      const reader = new FileReader();
      reader.onload = function (event) {
        mammoth
          .extractRawText({ arrayBuffer: event.target.result })
          .then(function (result) {
            uploadStatus.textContent = "DOCX başarıyla okundu!";
            const info = extractInfoFromText(result.value);
            setTimeout(() => {
              sendInfoToContentScript(info);
            }, 1000);
          })
          .catch(function (err) {
            uploadStatus.textContent = "DOCX okunamadı!";
          });
      };
      reader.readAsArrayBuffer(file);
    } else {
      uploadStatus.textContent = "Desteklenmeyen dosya formatı!";
    }
  });

  function extractInfoFromText(text) {
    const emailMatch = text.match(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
    );
    const phoneMatch = text.match(
      /\+?\d{2,3}[\s-]?\d{3}[\s-]?\d{3,4}[\s-]?\d{2,4}/
    );
    const linkedinMatch = text.match(/linkedin\.com\/in\/[a-zA-Z0-9-]+/i);

    let name = "";
    const lines = text.split("\n").map((l) => l.trim());

    if (
      lines.length > 0 &&
      lines[0] &&
      !lines[0].includes("@") &&
      !/\d/.test(lines[0])
    ) {
      name = lines[0];
    }

    let currentCompany = "";
    const experienceSectionKeywords = [
      "work experience",
      "experience",
      "iş deneyimi",
      "deneyimler",
      "professional experience",
      "iş tecrübesi",
      "tecrübeler",
      "employment history",
      "career summary",
      "professional background",
    ];
    const companyIndicators = [
      "ltd",
      "inc",
      "llc",
      "corp",
      "gmbh",
      "a.ş",
      "holding",
      "group",
      "bank",
      "university",
      "technologies",
      "solutions",
      "services",
      "consulting",
      "limited",
      "incorporated",
      "corporation",
      "üniversitesi",
      "teknoloji",
      "danışmanlık",
      "grubu",
      "bankası",
    ];
    const nonCompanyKeywords = [
      "engineer",
      "developer",
      "manager",
      "specialist",
      "lead",
      "architect",
      "consultant",
      "analyst",
      "designer",
      "mühendis",
      "uzman",
      "geliştirici",
      "yönetici",
      "danışman",
      "assistant",
      "associate",
      "present",
      "current",
      "halen",
      "devam ediyor",
      "ocak",
      "şubat",
      "mart",
      "nisan",
      "mayıs",
      "haziran",
      "temmuz",
      "ağustos",
      "eylül",
      "ekim",
      "kasım",
      "aralık",
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
      "ayrıldı",
      "left",
      "remote",
      "istanbul",
      "ankara",
      "izmir",
      "london",
      "new york",
      "berlin",
      "türkiye",
      "usa",
      "germany",
      "united states",
      "united kingdom",
      "responsibilities",
      "achievements",
      "description",
      "görevler",
      "sorumluluklar",
      "başarılar",
      "açıklama",
      "proje",
      "project",
    ];
    const datePattern =
      /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}\s*-\s*(\d{4}|Present|Current|Halen|Devam Ediyor)|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|Present|Current|Halen|Devam Ediyor)/i;

    let inExperienceSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const lineLower = line.toLowerCase();

      if (!inExperienceSection) {
        if (
          experienceSectionKeywords.some(
            (keyword) =>
              lineLower.includes(keyword) &&
              line.length < 50 &&
              !datePattern.test(line)
          )
        ) {
          inExperienceSection = true;
          continue;
        }
      }

      if (inExperienceSection) {
        if (line.length > 2 && line.length < 80) {
          const words = line.split(/\s+/);
          const firstWord = words[0];

          let score = 0;
          if (
            firstWord &&
            firstWord.length > 0 &&
            firstWord[0] === firstWord[0].toUpperCase() &&
            isNaN(parseInt(firstWord))
          )
            score++; // Starts with capital, not a number

          if (companyIndicators.some((ind) => lineLower.includes(ind)))
            score += 2;

          let nonCompanyHit = false;
          for (const ncKey of nonCompanyKeywords) {
            if (lineLower.includes(ncKey)) {
              if (
                companyIndicators.some(
                  (ci) =>
                    lineLower.includes(ci) &&
                    lineLower.indexOf(ci) < lineLower.indexOf(ncKey) &&
                    words.length > 2
                )
              ) {
              } else {
                nonCompanyHit = true;
                break;
              }
            }
          }
          if (nonCompanyHit) score -= 2;

          if (datePattern.test(line)) score -= 3;

          if (i + 1 < lines.length && lines[i + 1]) {
            const nextLineLower = lines[i + 1].toLowerCase();
            if (
              nonCompanyKeywords.some(
                (ncKey) =>
                  nextLineLower.includes(ncKey) &&
                  !companyIndicators.some((ind) => nextLineLower.includes(ind))
              )
            ) {
              if (
                nonCompanyKeywords
                  .filter((k) =>
                    [
                      "engineer",
                      "developer",
                      "manager",
                      "specialist",
                      "uzman",
                      "mühendis",
                    ].includes(k)
                  )
                  .some((jt) => nextLineLower.includes(jt))
              ) {
                score += 1;
              }
            }
            if (
              words.length <= 2 &&
              lines[i + 1].split(/\\s+/).length <= 2 &&
              lines[i + 1][0] === lines[i + 1][0].toUpperCase() &&
              !datePattern.test(lines[i + 1])
            ) {
              score -= 1;
            }
          }

          if (score >= 1) {
            let companyCandidate = line.replace(datePattern, "").trim(); // Remove dates
            for (const title of [
              "Manager",
              "Engineer",
              "Developer",
              "Specialist",
              "Consultant",
              "Analyst",
            ]) {
              if (companyCandidate.endsWith(" " + title)) {
                companyCandidate = companyCandidate.substring(
                  0,
                  companyCandidate.lastIndexOf(" " + title)
                );
              }
            }
            companyCandidate = companyCandidate.replace(/,.*$/, "").trim();

            const candidateWords = companyCandidate.split(/\\s+/);
            const capitalizedWords = candidateWords.filter(
              (w) =>
                w.length > 0 &&
                w[0] === w[0].toUpperCase() &&
                isNaN(parseInt(w[0]))
            );

            if (
              companyCandidate.length > 3 &&
              (capitalizedWords.length / candidateWords.length >= 0.5 ||
                companyIndicators.some((ind) =>
                  companyCandidate.toLowerCase().includes(ind)
                ))
            ) {
              if (candidateWords.length >= 1 && candidateWords.length < 7) {
                currentCompany = companyCandidate;
                console.log(
                  "Found company candidate:",
                  currentCompany,
                  "from line:",
                  line
                );

                break;
              }
            }
          }
        }
        if (
          line.length > 100 ||
          line.startsWith("---") ||
          line.startsWith("***")
        ) {
          // Arbitrary break condition

          break;
        }
      }
    }

    if (!currentCompany) {
      const companyRegexGlobal =
        /([A-Z][A-Za-z.'&\s-]+(?:(?:,\\s*|-)\\s*(?:Inc|Ltd|LLC|Corp|GmbH|A\\.Ş\\.|Holding|Group|Bank|University|Technologies|Solutions|Services|Consulting))?)/g;
      let companiesGlobal = [];
      const allTextLines = text.split("\\n");
      for (const l of allTextLines) {
        if (!l || l.length < 3 || l.length > 100) continue;
        const lineLower = l.toLowerCase();
        const isLikelyJobTitle = nonCompanyKeywords.some(
          (jtKeyword) =>
            lineLower.includes(jtKeyword) &&
            (lineLower.includes("engineer") ||
              lineLower.includes("developer") ||
              lineLower.includes("manager"))
        );
        const isDateLine = datePattern.test(l);

        if (!isLikelyJobTitle && !isDateLine) {
          let globalMatch;
          while ((globalMatch = companyRegexGlobal.exec(l)) !== null) {
            const matchedCompany = globalMatch[1].trim();
            const wordsInMatch = matchedCompany.split(/\\s+/);
            if (
              wordsInMatch.length === 2 &&
              wordsInMatch.every(
                (w) =>
                  w[0] === w[0].toUpperCase() &&
                  w.slice(1) === w.slice(1).toLowerCase()
              )
            ) {
              if (
                !companyIndicators.some((ind) =>
                  matchedCompany.toLowerCase().includes(ind)
                )
              ) {
                continue;
              }
            }
            if (
              wordsInMatch.length >= 1 ||
              companyIndicators.some((ind) =>
                matchedCompany.toLowerCase().includes(ind)
              )
            ) {
              if (matchedCompany.length > 3 && matchedCompany.length < 70) {
                companiesGlobal.push(matchedCompany);
              }
            }
          }
        }
      }
      if (companiesGlobal.length > 0) {
        currentCompany = companiesGlobal[companiesGlobal.length - 1];
      }
    }

    return {
      name: name,
      email: emailMatch ? emailMatch[0] : "",
      phone: phoneMatch ? phoneMatch[0] : "",
      linkedin: linkedinMatch ? linkedinMatch[0] : "",
      company: currentCompany.trim(),
    };
  }

  function sendInfoToContentScript(info) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs && tabs.length > 0 && tabs[0] && tabs[0].id != null) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "ping" },
          function (response) {
            if (chrome.runtime.lastError) {
              console.error(
                "Content script not ready:",
                chrome.runtime.lastError.message
              );
              const statusDisplay = document.getElementById("upload-status");
              if (statusDisplay) {
                statusDisplay.textContent =
                  "Hata: Sayfa ile iletişim kurulamadı. Lütfen sayfayı yenileyin.";
                statusDisplay.style.color = "red";
              }
              return;
            }

            chrome.tabs.sendMessage(
              tabs[0].id,
              { action: "fillForm", data: info },
              function (response) {
                if (chrome.runtime.lastError) {
                  console.error(
                    "Error sending 'fillForm' message to content script:",
                    chrome.runtime.lastError.message
                  );
                  const statusDisplay =
                    document.getElementById("upload-status");
                  const infoDisplay = document.getElementById("extracted-info");
                  const errorMessage =
                    "Hata: Bilgiler sayfaya gönderilemedi. Sayfa desteklenmiyor veya yenilenmiş olabilir.";

                  if (statusDisplay) {
                    statusDisplay.textContent = errorMessage;
                    statusDisplay.style.color = "red";
                  } else if (infoDisplay) {
                    const errorP = document.createElement("p");
                    errorP.textContent = errorMessage;
                    errorP.style.color = "red";
                    if (infoDisplay.firstChild) {
                      infoDisplay.insertBefore(errorP, infoDisplay.firstChild);
                    } else {
                      infoDisplay.appendChild(errorP);
                    }
                  }
                } else {
                  const statusDisplay =
                    document.getElementById("upload-status");
                  if (
                    statusDisplay &&
                    !statusDisplay.textContent.includes("Hata:")
                  ) {
                    statusDisplay.textContent =
                      "CV başarıyla okundu ve form dolduruldu!";
                    statusDisplay.style.color = "green";
                  }
                }
              }
            );
          }
        );
      } else {
        console.error(
          "No active tab found or tab ID is missing for sending 'fillForm'."
        );
        const statusDisplay = document.getElementById("upload-status");
        if (statusDisplay) {
          statusDisplay.textContent =
            "Hata: Bilgiler gönderilemedi, aktif sekme bulunamadı.";
          statusDisplay.style.color = "red";
        }
      }
    });
  }

  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "../libs/pdf.worker.js";
  }
});
