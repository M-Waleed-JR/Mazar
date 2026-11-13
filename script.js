// ==========================================
// مشروع مزار (Mazar) - منصة استكشاف الفنادق
// ==========================================
const API = "c3926d7198msh7f865f753f0716bp1348e9jsn75c8521a48ba";

// 1. تهيئة الخريطة المجانية (Leaflet + OpenStreetMap)
const map = L.map("mapContainer").setView([30.0444, 31.2357], 6);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// مجموعة لإدارة وحفظ العلامات
const markersLayer = L.layerGroup().addTo(map);

// متغيرات حفظ الحالة وتفادي التكرار
let currentCountry = "";
let cachedMarkers = [];
let countriesCache = null;

// عناصر واجهة المستخدم
const searchInput = document.getElementById("search");
const autoSuggestList = document.getElementById("auto_suggest_list");
const clearSearchBtn = document.getElementById("clear_search");
const inputSearchForm = document.getElementById("input_search");
const submitBtn = document.getElementById("submit");
const resultsSummary = document.getElementById("results_summary");
const resultsText = document.getElementById("results_text");
const clearMarkersBtn = document.getElementById("clear_markers_btn");
const tagChips = document.querySelectorAll(".tag-chip");

// جلب قائمة الدول وتخزينها في الكاش لضمان سرعة فائقة
const fetchCountries = async () => {
  if (countriesCache) return countriesCache;
  const urlx =
    "https://wft-geo-db.p.rapidapi.com/v1/geo/countries?limit=10&offset=40";
  const optionsx = {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": API,
      "X-RapidAPI-Host": "wft-geo-db.p.rapidapi.com",
    },
  };
  try {
    const response = await fetch(urlx, optionsx);
    countriesCache = await response.json();
    return countriesCache;
  } catch (err) {
    console.error("Error fetching countries:", err);
    return { data: [] };
  }
};

// دالة جلب الفنادق وتصفيتها بدقة لدولة واحدة فقط
async function getMarkers(country) {
  if (!country) return [];
  const url = `https://hotels4.p.rapidapi.com/locations/v3/search?q=${encodeURIComponent(
    country
  )}`;
  const options = {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": API,
      "X-RapidAPI-Host": "hotels4.p.rapidapi.com",
    },
  };

  try {
    const response = await fetch(url, options);
    const result = await response.json();
    const targetCountry = country.trim().toLowerCase();

    const filtered = [];

    if (result.sr && Array.isArray(result.sr)) {
      result.sr.forEach((pos) => {
        if (!pos.coordinates || !pos.coordinates.lat || !pos.coordinates.long) {
          return;
        }

        const countryName =
          pos.hierarchyInfo?.country?.name?.trim().toLowerCase();
        const secondary = (
          pos.regionNames?.secondaryDisplayName || ""
        ).toLowerCase();
        const fullName = (pos.regionNames?.fullName || "").toLowerCase();

        // فلترة دقيقة تمنع أي مكان ينتمي لدولة أخرى تماماً
        let isMatch = false;
        if (countryName) {
          isMatch =
            countryName === targetCountry ||
            countryName.includes(targetCountry) ||
            targetCountry.includes(countryName);
        } else {
          isMatch =
            secondary.includes(targetCountry) || fullName.includes(targetCountry);
        }

        if (isMatch) {
          const lat = parseFloat(pos.coordinates.lat);
          const lng = parseFloat(pos.coordinates.long);
          const title =
            pos.regionNames?.primaryDisplayName ||
            pos.regionNames?.displayName ||
            country;
          const subtitle = pos.regionNames?.secondaryDisplayName || "";

          filtered.push({
            latLng: [lat, lng],
            title: title,
            subtitle: subtitle,
          });
        }
      });
    }

    return filtered;
  } catch (err) {
    console.error("Error in getMarkers:", err);
    return [];
  }
}

// قاعدة بيانات للأماكن والأحياء الشهيرة وأسماء الفنادق الوهمية
const cityMockDatabase = {
  alexandria: {
    names: [
      "فندق سيدي بشر بلازا (Sidi Bishr Plaza)",
      "فندق رويال بالاس الإسكندرية (Royal Palace)",
      "فندق توليب سي فيو (Tolip Sea View)",
      "فندق فور سيزونز سان ستيفانو (Four Seasons)",
    ],
    districts: [
      "الإسكندرية - سيدي بشر، شارع الجيش (على البحر مباشرة)",
      "الإسكندرية - سيدي بشر ترام، بجوار فندق المحروسة",
      "الإسكندرية - كورنيش محطة الرمل، وسط المدينة",
      "الإسكندرية - منطقة المعمورة الشاطئ، بوابة 2",
    ],
    phonePrefix: "+20 10 ",
  },
  cairo: {
    names: [
      "فندق جراند نايل تاور (Grand Nile Tower)",
      "فندق ماريوت الزمالك الإمبراطوري",
      "فندق شتيجنبرجر التحرير (Steigenberger)",
      "فندق فور سيزونز نايل بلازا (Four Seasons)",
    ],
    districts: [
      "القاهرة - حي الزمالك، شارع أبو الفدا",
      "القاهرة - وسط البلد، ميدان التحرير",
      "القاهرة - كورنيش المعادي، شارع 9",
      "القاهرة - مصر الجديدة، ميدان الكوربة",
    ],
    phonePrefix: "+20 11 ",
  },
  "sharm el sheikh": {
    names: [
      "منتجع ريكسوس شرم الشيخ (Rixos Resort)",
      "فندق فور سيزونز ريزورت (Four Seasons)",
      "منتجع جاز ميرابيل بيتش (Jaz Mirabel)",
      "فندق سلطان جاردنز ريزورت",
    ],
    districts: [
      "شرم الشيخ - خليج نعمة، طريق السلام",
      "شرم الشيخ - خليج القرش (Sharks Bay)",
      "شرم الشيخ - هضبة أم السيد السياحية",
      "شرم الشيخ - خليج نبق المحمي",
    ],
    phonePrefix: "+20 12 ",
  },
  hurghada: {
    names: [
      "فندق ومنتجع الباتروس بالاس (Albatros)",
      "منتجع شتايجنبرجر الداو (Steigenberger)",
      "فندق ماريوت بيتش ريزورت",
      "منتجع تيتانيك رويال أكوا بارك",
    ],
    districts: [
      "الغردقة - الممشى السياحي الجديد",
      "الغردقة - منتجع سهل حشيش الفاخر",
      "الغردقة - مارينا الغردقة، شارع الشيراتون",
      "الغردقة - منتجع الجونة، المارينا",
    ],
    phonePrefix: "+20 10 ",
  },
  luxor: {
    names: [
      "فندق قصر الشتاء التاريخي (Winter Palace)",
      "فندق هيلتون الأقصر ريزورت",
      "فندق سونستا سان جورج الأقصر",
      "فندق إيزيس آيلاند الأقصر",
    ],
    districts: [
      "الأقصر - كورنيش النيل، أمام معبد الأقصر",
      "الأقصر - الضفة الشرقية للنيل",
      "الأقصر - طريق العوامية السياحي",
      "الأقصر - جزيرة التمساح النيلية",
    ],
    phonePrefix: "+20 15 ",
  },
  berlin: {
    names: [
      "فندق أدلون كمبينسكي (Hotel Adlon)",
      "فندق ريتز كارلتون برلين (The Ritz-Carlton)",
      "فندق جراند حياة برلين (Grand Hyatt)",
    ],
    districts: [
      "برلين - حي ميتيه (Mitte)، ساحة باريسر",
      "برلين - شارع كورفورستندام (Kurfürstendamm)",
      "برلين - ساحة بوتسدامر (Potsdamer Platz)",
    ],
    phonePrefix: "+49 30 ",
  },
  "san salvador": {
    names: [
      "فندق بارسيلو سان سلفادور (Barceló)",
      "فندق شيراتون بريزيدنتي (Sheraton)",
      "فندق كراون بلازا سان سلفادور",
    ],
    districts: [
      "سان سلفادور - كولونيا إسكالون (Colonia Escalón)",
      "سان سلفادور - حي سان بينيتو الفاخر",
      "سان سلفادور - مجمع بوما بلازا",
    ],
    phonePrefix: "+503 2 ",
  },
};

// دالة توليد بيانات الفندق الوهمية (اسم وهمي، موقع تفصيلي داخل المدينة، ورقم موبايل وهمي)
function generateMockHotelData(rawTitle, countryName, index) {
  const norm = (rawTitle || "").toLowerCase();
  const isEgypt = (countryName || "").toLowerCase().includes("egypt");

  let matched = null;
  for (const k of Object.keys(cityMockDatabase)) {
    if (norm.includes(k)) {
      matched = cityMockDatabase[k];
      break;
    }
  }

  let name, district, phonePrefix;
  if (matched) {
    name = matched.names[index % matched.names.length];
    district = matched.districts[index % matched.districts.length];
    phonePrefix = matched.phonePrefix;
  } else if (norm === "egypt" || norm === countryName.toLowerCase()) {
    name = "منتجع واحة النيل الملكي (Nile Oasis Resort)";
    district = "مصر - منتجع الواحات، طريق الصعيد الصحراوي";
    phonePrefix = "+20 10 ";
  } else {
    name = `فندق جراند ${rawTitle} الفاخر`;
    district = `${rawTitle} - وسط المدينة، الشارع التجاري الرئيسي`;
    phonePrefix = isEgypt ? "+20 10 " : "+1 ";
  }

  // توليد رقم موبايل وهمي واقعي
  const num1 = 2000 + ((index * 473) % 7000);
  const num2 = 3000 + ((index * 617) % 6000);
  const phone = `${phonePrefix}${num1} ${num2}`;
  const phoneClean = phone.replace(/\s+/g, "");

  // سعر وهمي مناسب للدولة
  const price = isEgypt
    ? `${1200 + ((index * 250) % 1500)} ج.م / ليلة`
    : `$${75 + ((index * 30) % 150)} / ليلة`;

  return { name, district, phone, phoneClean, price };
}

// دالة رسم العلامات على الخريطة
function renderMarkers(markersList, countryName) {
  markersLayer.clearLayers();

  if (!markersList || markersList.length === 0) {
    if (resultsSummary) resultsSummary.style.display = "none";
    Swal.fire({
      icon: "warning",
      title: "لا توجد نتائج",
      text: `لم يتم العثور على فنادق مطابقة في دولة "${countryName}" في قاعدة البيانات المجانية.`,
      confirmButtonText: "حسناً",
      confirmButtonColor: "#0284c7",
    });
    return;
  }

  const leafletMarkers = markersList.map((m, index) => {
    const marker = L.marker(m.latLng).addTo(markersLayer);

    // توليد البيانات الوهمية للفندق (اسم وهمي، موقع تفصيلي، ورقم موبايل وهمي)
    const mockHotel = generateMockHotelData(m.title, countryName, index);

    marker.bindPopup(`
      <div class="custom-hotel-popup">
        <div class="hotel-popup-badge">
          <span class="stars">⭐⭐⭐⭐⭐</span>
          <span class="hotel-price">${mockHotel.price}</span>
        </div>
        <h3 class="hotel-name">${mockHotel.name}</h3>
        
        <div class="hotel-info-item">
          <span class="info-icon">📍</span>
          <span class="info-text"><strong>الموقع:</strong> ${mockHotel.district}</span>
        </div>
        
        <div class="hotel-info-item">
          <span class="info-icon">📱</span>
          <span class="info-text"><strong>هاتف الحجز:</strong> <a href="tel:${mockHotel.phoneClean}" class="phone-link">${mockHotel.phone}</a></span>
        </div>

        <div class="hotel-popup-footer">
          <a href="tel:${mockHotel.phoneClean}" class="popup-call-btn">
            <span>📞 اتصال سريع</span>
          </a>
        </div>
      </div>
    `);
    return marker;
  });

  const group = L.featureGroup(leafletMarkers);
  map.fitBounds(group.getBounds(), { padding: [60, 60], maxZoom: 14 });

  // تحديث شريط ملخص النتائج
  if (resultsSummary && resultsText) {
    resultsText.textContent = `تم العثور على ${markersList.length} أماكن في ${countryName}`;
    resultsSummary.style.display = "flex";
  }
}

// دالة تنفيذ البحث الموحدة
async function performSearch(country) {
  const query = (country || searchInput.value || "").trim();

  if (!query) {
    Swal.fire({
      icon: "info",
      title: "تنبيه",
      text: "يرجى كتابة أو اختيار اسم الدولة أولاً.",
      confirmButtonText: "حسناً",
      confirmButtonColor: "#0284c7",
    });
    return;
  }

  // تحديث نص الحقل إذا جاء من زر خارجي
  searchInput.value = query;
  if (clearSearchBtn) clearSearchBtn.style.display = "flex";
  hideDropdown();

  // إذا كانت البيانات مجلوبة مسبقاً لنفس الدولة
  if (
    currentCountry.toLowerCase() === query.toLowerCase() &&
    cachedMarkers.length > 0
  ) {
    renderMarkers(cachedMarkers, query);
    return;
  }

  // تفعيل حالة التحميل
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = `
    <span>جاري البحث...</span>
  `;
  submitBtn.disabled = true;

  try {
    currentCountry = query;
    cachedMarkers = await getMarkers(query);
    renderMarkers(cachedMarkers, query);
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

// عرض القائمة المنسدلة
function showDropdown(items) {
  if (!items || items.length === 0) {
    autoSuggestList.innerHTML = `<li style="color:#94a3b8; cursor:default;">لا توجد دول مطابقة</li>`;
    autoSuggestList.style.display = "block";
    return;
  }

  autoSuggestList.innerHTML = items
    .map(
      (c) => `
      <li data-country="${c.name}">
        <span>${c.name}</span>
        ${c.code ? `<span class="country-code">${c.code}</span>` : ""}
      </li>`
    )
    .join("");
  autoSuggestList.style.display = "block";
}

function hideDropdown() {
  autoSuggestList.style.display = "none";
}

// عند التركيز (Focus) على حقل البحث: عرض الدول المتاحة
searchInput.addEventListener("focus", async () => {
  const data = await fetchCountries();
  if (data && data.data) {
    const val = searchInput.value.trim().toLowerCase();
    if (!val) {
      showDropdown(data.data);
    } else {
      const filtered = data.data.filter((c) =>
        c.name.toLowerCase().includes(val)
      );
      showDropdown(filtered);
    }
  }
});

// عند الكتابة في حقل البحث: فلترة حية
searchInput.addEventListener("input", async (e) => {
  const val = e.target.value.trim().toLowerCase();
  clearSearchBtn.style.display = val ? "flex" : "none";

  const data = await fetchCountries();
  if (!data || !data.data) return;

  if (!val) {
    showDropdown(data.data);
    return;
  }

  const matches = data.data.filter((c) =>
    c.name.toLowerCase().includes(val)
  );
  showDropdown(matches);
});

// اختيار دولة من القائمة المنسدلة
autoSuggestList.addEventListener("click", (e) => {
  const li = e.target.closest("li");
  if (!li || !li.dataset.country) return;
  const country = li.dataset.country;
  searchInput.value = country;
  clearSearchBtn.style.display = "flex";
  hideDropdown();
  performSearch(country);
});

// زر مسح محتوى البحث
if (clearSearchBtn) {
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchBtn.style.display = "none";
    hideDropdown();
    searchInput.focus();
  });
}

// شرائح الوجهات الشائعة (Quick Chips)
tagChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const country = chip.dataset.country;
    performSearch(country);
  });
});

// زر مسح العلامات
if (clearMarkersBtn) {
  clearMarkersBtn.addEventListener("click", () => {
    markersLayer.clearLayers();
    if (resultsSummary) resultsSummary.style.display = "none";
    cachedMarkers = [];
    currentCountry = "";
  });
}

// إغلاق القائمة عند النقر في الخارج
document.addEventListener("click", (e) => {
  if (
    !e.target.closest(".search-field-container") &&
    !e.target.closest("#auto_suggest_list")
  ) {
    hideDropdown();
  }
});

// إرسال النموذج عند الضغط على الزر أو زر Enter
inputSearchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  performSearch();
});

// تحميل قائمة الدول مسبقاً في الخلفية
fetchCountries();

/* Sweet Alert warning */
window.addEventListener("DOMContentLoaded", () => {
  Swal.fire({
    title: "مرحباً بك في مزار (Mazar)",
    html: `
      <div style="direction: rtl; text-align: center; line-height: 1.8;">
        منصة <b>مزار (Mazar)</b> مخصصة <b>لأغراض تعليمية واستعراضية</b>.
        <br><br>
        جميع الـ <bdi>APIs</bdi> المستخدمة مجانية، وهو سبب محدودية عدد الدول المتوفرة في التطبيق وليست كل دول العالم.
      </div>
    `,
    icon: "info",
    confirmButtonText: "استكشف مزار الآن",
    confirmButtonColor: "#0284c7",
    allowOutsideClick: false,
  });
});
