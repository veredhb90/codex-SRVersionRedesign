// ── Mandatory Terms of Use / Risk Disclaimer gate ───────────────────
// Blocking (non-dismissable) modal shown on every authenticated page until
// the logged-in user has signed the current TERMS_VERSION. Must match
// backend/config/termsVersion.js exactly — bump both together to force
// everyone, including users who already signed an older version, to re-sign.
const Terms = {
  VERSION: '1.0',

  CONTENT: {
    en: {
      dir: 'ltr',
      title: 'Terms of Use & Risk Disclaimer',
      intro: 'Please read this document carefully before using SwingRush.',
      sections: [
        {
          h: '1. Not Financial Advice',
          p: 'SwingRush is a social trading network and an informational/educational platform — nothing more. Nothing on this platform, including the Free Signal Engine, Pro Engine scores, AI chat responses, community posts, technical indicators, or any shared trade setup, constitutes financial, investment, tax, or legal advice, nor a recommendation or solicitation to buy or sell any security or instrument. SwingRush is not a registered investment advisor, broker-dealer, or financial institution.',
        },
        {
          h: '2. No Guarantee of Results',
          p: 'Historical or hypothetical performance shown anywhere on the platform is not indicative of future results. All markets involve risk, including the potential loss of some or all invested capital.',
        },
        {
          h: '3. Your Sole Responsibility',
          p: 'Every trading or investment decision you make using information from SwingRush is made entirely at your own discretion and risk. You alone are responsible for evaluating the merits and risks of any transaction before acting on it.',
        },
        {
          h: '4. Limitation of Liability',
          p: 'To the fullest extent permitted by law, SwingRush, its owners, operators, employees, and affiliates are not liable for any direct, indirect, incidental, consequential, or other loss or damage of any kind — including trading losses — arising from or related to your use of the platform, your reliance on any content in it, or any error, delay, or interruption in the service.',
        },
        {
          h: '5. Community Content',
          p: 'Trade ideas, comments, and sentiment shared by other users are their own personal opinions, not verified or endorsed by SwingRush.',
        },
        {
          h: '6. Acceptance',
          p: 'By signing below, you confirm that you have read, understood, and agree to these terms, and that you are using SwingRush for informational and community purposes only, entirely at your own risk.',
        },
      ],
      scrollHint: 'Scroll to the end to continue',
      dateLabel: 'Date',
      signatureLabel: 'Full legal name (signature)',
      signaturePlaceholder: 'Type your full name',
      checkboxLabel: 'I have read and fully understand the above, and I voluntarily agree to these terms.',
      agreeBtn: 'I Agree & Sign',
      savingBtn: 'Saving…',
      errName: 'Please type your full name to sign.',
      errCheck: 'Please confirm you have read and agree to the terms.',
      errGeneric: 'Could not save your signature. Please try again.',
    },
    ar: {
      dir: 'rtl',
      title: 'شروط الاستخدام وإخلاء المسؤولية عن المخاطر',
      intro: 'يرجى قراءة هذا المستند بعناية قبل استخدام SwingRush.',
      sections: [
        {
          h: '١. ليست نصيحة مالية',
          p: 'سوينج رَش هي شبكة تداول اجتماعية ومنصة معلوماتية وتعليمية، لا أكثر. لا شيء في هذه المنصة — بما في ذلك محرك الإشارة المجاني، أو نتائج محرك Pro، أو ردود الذكاء الاصطناعي في المحادثة، أو منشورات المجتمع، أو المؤشرات الفنية، أو أي صفقة تداول مشتركة — يشكل نصيحة مالية أو استثمارية أو ضريبية أو قانونية، ولا يُعد توصية أو عرضًا لشراء أو بيع أي أداة مالية. سوينج رَش ليست مستشارًا استثماريًا مرخصًا، ولا وسيط تداول، ولا مؤسسة مالية.',
        },
        {
          h: '٢. لا ضمان للنتائج',
          p: 'الأداء التاريخي أو الافتراضي المعروض في أي مكان على المنصة لا يدل على النتائج المستقبلية. تنطوي جميع الأسواق على مخاطر، بما في ذلك احتمال خسارة جزء من رأس المال المستثمر أو كله.',
        },
        {
          h: '٣. مسؤوليتك وحدك',
          p: 'كل قرار تداول أو استثمار تتخذه بناءً على معلومات من سوينج رَش يتم بمحض تقديرك ومسؤوليتك الخاصة بالكامل. أنت وحدك المسؤول عن تقييم مزايا ومخاطر أي معاملة قبل تنفيذها.',
        },
        {
          h: '٤. تحديد المسؤولية',
          p: 'إلى أقصى حد يسمح به القانون، لن تتحمل سوينج رَش ومالكوها ومشغلوها وموظفوها والشركات التابعة لها المسؤولية عن أي خسارة أو ضرر مباشر أو غير مباشر أو عرضي أو تبعي أو من أي نوع آخر — بما في ذلك خسائر التداول — ناشئ عن استخدامك للمنصة أو اعتمادك على أي محتوى فيها، أو عن أي خطأ أو تأخير أو انقطاع في الخدمة.',
        },
        {
          h: '٥. محتوى المجتمع',
          p: 'أفكار التداول والتعليقات والمعنويات التي يشاركها مستخدمون آخرون هي آراؤهم الشخصية الخاصة، وليست موثقة أو معتمدة من قبل سوينج رَش.',
        },
        {
          h: '٦. الموافقة',
          p: 'بتوقيعك أدناه، فإنك تؤكد أنك قرأت هذه الشروط وفهمتها ووافقت عليها، وأنك تستخدم سوينج رَش لأغراض معلوماتية ومجتمعية فقط، وعلى مسؤوليتك الخاصة بالكامل.',
        },
      ],
      scrollHint: 'مرر للأسفل حتى النهاية للمتابعة',
      dateLabel: 'التاريخ',
      signatureLabel: 'الاسم القانوني الكامل (التوقيع)',
      signaturePlaceholder: 'اكتب اسمك الكامل',
      checkboxLabel: 'لقد قرأت ما ورد أعلاه وفهمته بالكامل، وأوافق طواعية على هذه الشروط.',
      agreeBtn: 'أوافق وأوقّع',
      savingBtn: 'جار الحفظ…',
      errName: 'يرجى كتابة اسمك الكامل للتوقيع.',
      errCheck: 'يرجى تأكيد أنك قرأت الشروط ووافقت عليها.',
      errGeneric: 'تعذر حفظ توقيعك. حاول مرة أخرى.',
    },
    he: {
      dir: 'rtl',
      title: 'תנאי שימוש וכתב ויתור על אחריות בסיכונים',
      intro: 'נא לקרוא מסמך זה בעיון לפני השימוש ב-SwingRush.',
      sections: [
        {
          h: '1. אינו ייעוץ פיננסי',
          p: 'SwingRush היא רשת חברתית למסחר ופלטפורמת מידע והדרכה בלבד. שום דבר בפלטפורמה — לרבות מנוע האיתותים החינמי, ציוני מנוע ה-Pro, תשובות הצ\'אט מבוסס הבינה המלאכותית, פוסטים של הקהילה, אינדיקטורים טכניים או כל עסקה משותפת — אינו מהווה ייעוץ פיננסי, השקעתי, מיסויי או משפטי, ואינו המלצה או הצעה לקנייה או מכירה של נייר ערך או מכשיר פיננסי כלשהו. SwingRush אינה יועצת השקעות מורשית, ברוקר, או מוסד פיננסי.',
        },
        {
          h: '2. אין ערובה לתוצאות',
          p: 'ביצועים היסטוריים או היפותטיים המוצגים בכל מקום בפלטפורמה אינם מעידים על תוצאות עתידיות. כל שוק כרוך בסיכון, לרבות האפשרות לאובדן חלק מההון המושקע או כולו.',
        },
        {
          h: '3. האחריות שלכם בלבד',
          p: 'כל החלטת מסחר או השקעה שתקבלו על סמך מידע מ-SwingRush מתקבלת אך ורק לפי שיקול דעתכם ובאחריותכם הבלעדית. אתם האחראים הבלעדיים להערכת היתרונות והסיכונים של כל עסקה בטרם ביצועה.',
        },
        {
          h: '4. הגבלת אחריות',
          p: 'במידה המרבית המותרת על פי דין, SwingRush, בעליה, מפעיליה, עובדיה והגורמים הקשורים אליה לא יישאו באחריות לכל אובדן או נזק ישיר, עקיף, אגבי, תוצאתי או מכל סוג אחר — לרבות הפסדי מסחר — הנובעים משימושכם בפלטפורמה, מהסתמכות על תוכן כלשהו בה, או מכל שגיאה, עיכוב או הפרעה בשירות.',
        },
        {
          h: '5. תוכן קהילתי',
          p: 'רעיונות מסחר, תגובות ותחושות שמשתפים משתמשים אחרים הם דעתם האישית בלבד, ואינם מאומתים או מאושרים על ידי SwingRush.',
        },
        {
          h: '6. הסכמה',
          p: 'בחתימתכם למטה, הנכם מאשרים כי קראתם את התנאים הללו, הבנתם אותם ומסכימים להם, וכי אתם משתמשים ב-SwingRush למטרות מידע וקהילה בלבד, על אחריותכם הבלעדית.',
        },
      ],
      scrollHint: 'גללו עד הסוף כדי להמשיך',
      dateLabel: 'תאריך',
      signatureLabel: 'שם מלא (חתימה)',
      signaturePlaceholder: 'הקלידו את שמכם המלא',
      checkboxLabel: 'קראתי את האמור לעיל, הבנתי אותו במלואו, ואני מסכים/ה מרצוני החופשי לתנאים אלה.',
      agreeBtn: 'אני מסכים/ה וחותם/ת',
      savingBtn: 'שומר…',
      errName: 'נא להקליד את שמכם המלא כדי לחתום.',
      errCheck: 'נא לאשר שקראתם את התנאים ומסכימים להם.',
      errGeneric: 'לא ניתן היה לשמור את החתימה. נסו שוב.',
    },
  },

  LANG_LABELS: { en: 'English', ar: 'العربية', he: 'עברית' },

  // null until the user explicitly switches inside the modal — until then,
  // follows the site's currently selected language like everything else.
  activeLang: null,

  lang() {
    if (this.activeLang && this.CONTENT[this.activeLang]) return this.activeLang;
    var l = (window.SRLang && window.SRLang.lang) || document.documentElement.lang || 'en';
    return this.CONTENT[l] ? l : 'en';
  },

  // Re-renders the modal in the chosen language, carrying over whatever the
  // user already typed as their signature so switching languages mid-read
  // doesn't lose their input. Scroll-to-end and the checkbox reset
  // intentionally — the user must actually read the new-language text.
  switchLang(lang) {
    if (!this.CONTENT[lang]) return;
    var sigInput = document.getElementById('sr-terms-sig');
    var carriedSig = sigInput ? sigInput.value : '';
    this.activeLang = lang;
    var modal = document.getElementById('sr-terms-gate');
    if (modal) modal.remove();
    document.body.style.overflow = '';
    this.show();
    var newSigInput = document.getElementById('sr-terms-sig');
    if (newSigInput && carriedSig) newSigInput.value = carriedSig;
  },

  scrolledToEnd: false,

  escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  },

  show() {
    if (document.getElementById('sr-terms-gate')) return;
    this.scrolledToEnd = false;
    var c = this.CONTENT[this.lang()];
    var today = new Date().toLocaleDateString(this.lang() === 'en' ? 'en-US' : this.lang() === 'ar' ? 'ar-EG' : 'he-IL', { year: 'numeric', month: 'long', day: 'numeric' });

    var sectionsHtml = c.sections.map(function(s) {
      return '<h3 style="font-size:14px;font-weight:800;color:var(--text,#0D2244);margin:16px 0 6px;">' + s.h + '</h3>' +
        '<p style="font-size:13px;line-height:1.7;color:var(--text2,#4a5568);margin:0;">' + s.p + '</p>';
    }).join('');

    var activeLang = this.lang();
    var self = this;
    var langSwitcherHtml = Object.keys(this.LANG_LABELS).map(function(l) {
      var isActive = l === activeLang;
      return '<button type="button" onclick="Terms.switchLang(\'' + l + '\')" style="padding:5px 12px;border-radius:999px;border:1.5px solid ' + (isActive ? 'var(--accent,#1565C0)' : 'var(--border,#D6E4F5)') + ';background:' + (isActive ? 'var(--accent,#1565C0)' : 'transparent') + ';color:' + (isActive ? '#fff' : 'var(--text2,#4a5568)') + ';font-size:11.5px;font-weight:700;cursor:pointer;">' + self.LANG_LABELS[l] + '</button>';
    }).join('');

    var modal = document.createElement('div');
    modal.id = 'sr-terms-gate';
    modal.dir = c.dir;
    modal.style.cssText = 'position:fixed;inset:0;z-index:95000;background:rgba(8,15,36,0.92);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML =
      '<div style="background:var(--surface,#fff);border-radius:18px;max-width:620px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,0.4);overflow:hidden;">' +
        '<div style="padding:20px 26px 14px;border-bottom:1px solid var(--border,#D6E4F5);">' +
          '<div style="display:flex;gap:6px;margin-bottom:12px;">' + langSwitcherHtml + '</div>' +
          '<div style="font-size:18px;font-weight:850;color:var(--text,#0D2244);">' + this.escapeHtml(c.title) + '</div>' +
          '<div style="font-size:12.5px;color:var(--muted,#64748b);margin-top:4px;">' + this.escapeHtml(c.intro) + '</div>' +
        '</div>' +
        '<div id="sr-terms-scroll" style="padding:16px 26px;overflow-y:auto;flex:1;">' + sectionsHtml + '</div>' +
        '<div style="padding:8px 26px;text-align:center;font-size:11px;color:var(--muted,#64748b);border-top:1px solid var(--border,#D6E4F5);" id="sr-terms-scroll-hint">⬇ ' + this.escapeHtml(c.scrollHint) + '</div>' +
        '<div style="padding:16px 26px 22px;border-top:1px solid var(--border,#D6E4F5);">' +
          '<div id="sr-terms-err" style="display:none;background:var(--red-bg,#fdecea);color:var(--red,#c62828);font-size:12.5px;font-weight:600;padding:9px 12px;border-radius:8px;margin-bottom:12px;"></div>' +
          '<div style="display:flex;gap:10px;margin-bottom:10px;">' +
            '<div style="flex:1;">' +
              '<label style="font-size:11px;font-weight:700;color:var(--muted,#64748b);display:block;margin-bottom:4px;">' + this.escapeHtml(c.dateLabel) + '</label>' +
              '<div style="padding:10px 12px;border:1.5px solid var(--border,#D6E4F5);border-radius:10px;font-size:13px;color:var(--text2,#4a5568);background:var(--bg2,#F7FAFE);">' + this.escapeHtml(today) + '</div>' +
            '</div>' +
            '<div style="flex:2;">' +
              '<label style="font-size:11px;font-weight:700;color:var(--muted,#64748b);display:block;margin-bottom:4px;">' + this.escapeHtml(c.signatureLabel) + '</label>' +
              '<input id="sr-terms-sig" type="text" maxlength="100" placeholder="' + this.escapeHtml(c.signaturePlaceholder) + '" style="width:100%;padding:10px 12px;border:1.5px solid var(--border,#D6E4F5);border-radius:10px;font-size:13px;outline:none;box-sizing:border-box;color:var(--text,#0D2244);background:var(--surface,#fff);"/>' +
            '</div>' +
          '</div>' +
          '<label style="display:flex;align-items:flex-start;gap:8px;font-size:12.5px;line-height:1.5;color:var(--text2,#4a5568);cursor:pointer;margin-bottom:14px;">' +
            '<input id="sr-terms-check" type="checkbox" style="margin-top:2px;flex-shrink:0;width:16px;height:16px;"/>' +
            '<span>' + this.escapeHtml(c.checkboxLabel) + '</span>' +
          '</label>' +
          '<button id="sr-terms-submit" onclick="Terms.submit()" style="width:100%;padding:14px;background:linear-gradient(135deg,#1565C0,#0D47A1);color:#fff;border:none;border-radius:14px;font-weight:700;font-size:15px;cursor:pointer;">' +
            this.escapeHtml(c.agreeBtn) +
          '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    var scrollEl = document.getElementById('sr-terms-scroll');
    var hint = document.getElementById('sr-terms-scroll-hint');
    var self = this;
    var checkScroll = function() {
      if (scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 24) {
        self.scrolledToEnd = true;
        if (hint) hint.style.display = 'none';
      }
    };
    scrollEl.addEventListener('scroll', checkScroll);
    checkScroll(); // short documents that don't need scrolling shouldn't block on the hint
  },

  showErr(msg) {
    var el = document.getElementById('sr-terms-err');
    if (!el) return;
    el.textContent = '⚠️ ' + msg;
    el.style.display = 'block';
  },

  async submit() {
    var c = this.CONTENT[this.lang()];
    var sig = (document.getElementById('sr-terms-sig').value || '').trim();
    var checked = document.getElementById('sr-terms-check').checked;
    if (!sig) { this.showErr(c.errName); return; }
    if (!checked) { this.showErr(c.errCheck); return; }

    var btn = document.getElementById('sr-terms-submit');
    btn.textContent = c.savingBtn;
    btn.disabled = true;
    try {
      await API.acceptTerms({ signatureName: sig, language: this.lang() });
      document.body.style.overflow = '';
      var modal = document.getElementById('sr-terms-gate');
      if (modal) modal.remove();
    } catch (e) {
      btn.textContent = c.agreeBtn;
      btn.disabled = false;
      this.showErr(e.message || c.errGeneric);
    }
  },

  // Call after login/on every authenticated page load. Blocking — no skip,
  // no dismiss button, no click-outside-to-close. Re-shows automatically if
  // the stored version doesn't match VERSION (covers both users who never
  // signed and existing users whose signed version is now outdated).
  async checkAndShow() {
    if (!window.Auth || !Auth.token()) return;
    try {
      var me = await API.me();
      var accepted = me.user && me.user.termsAccepted;
      if (accepted && accepted.version === this.VERSION) return;
      this.show();
    } catch (e) {}
  },
};

window.Terms = Terms;
