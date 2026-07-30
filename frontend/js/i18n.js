// SwingRush language layer: persistent EN/AR toggle with RTL support.
(function () {
  const AR = {
    'nav.login': 'تسجيل الدخول',
    'nav.feed': 'الخلاصة',
    'nav.logout': 'تسجيل الخروج',
    'nav.profile': 'الملف الشخصي',
    'nav.scanner': 'الماسح',
    'nav.join_free': 'انضم مجانا',
    'nav.back_feed': 'العودة للخلاصة',
    'nav.language': 'تغيير اللغة',

    'home.live_market_data': 'بيانات السوق مباشرة',
    'home.hero_sub': 'شبكة تداول اجتماعية ومحركات إشارات للأسهم والسلع والعملات الرقمية. شارك الصفقات، تابع المتداولين الأقوى، وقس أداءك بوضوح.',
    'home.ai_online': 'محلل الذكاء الاصطناعي متصل 24/7',
    'home.ai_strip_copy': 'إشارات فنية ومحفزات مباشرة وسياق السوق ومستويات المخاطر في استشارة واحدة.',
    'home.cta_create': 'إنشاء حساب مجاني',
    'home.cta_engine': 'جرّب المحرك المجاني',
    'home.stat_scanned': 'أداة ممسوحة',
    'home.stat_free': 'مجاني دائما',
    'home.stat_ai': 'تحليل مدعوم بالذكاء الاصطناعي',
    'home.terminal_title': 'شبكة الذكاء الاصطناعي المباشر',
    'home.terminal_status': 'الذكاء الاصطناعي متصل 24/7',
    'home.node_community': 'المجتمع',
    'home.node_scanner': 'السوق',
    'home.node_engine': 'قلب الذكاء',
    'home.node_news': 'الأخبار',
    'home.node_risk': 'المخاطر',
    'home.mini_signal': 'محرك الإشارات بالذكاء',
    'home.mini_signal_value': 'هيكل فني + مستويات',
    'home.mini_news': 'ذكاء المحفزات',
    'home.mini_news_value': 'أخبار مباشرة + سياق النتائج',
    'home.mini_social': 'معنويات السوق',
    'home.mini_social_value': 'صفقات المجتمع + مزاج السوق',
    'home.mini_risk': 'محرك المخاطر',
    'home.mini_risk_value': 'دخول وهدف ونقطة إلغاء',
    'home.ai_consult_eyebrow': 'استشارة ذكاء اصطناعي مباشرة',
    'home.ai_consult_title': 'اسأل المحلل عما يهم الآن.',
    'home.ai_consult_copy': 'مساعدك الذكي على مدار الساعة يجمع السعر المباشر والإشارات الفنية ومحفزات الأخبار ومستويات المخاطر قبل أن تقرر.',
    'home.ai_consult_open': 'فتح محادثة الذكاء',
    'home.ai_prompt_analyze': 'حلل NVDA',
    'home.ai_prompt_opportunities': 'اعثر على فرص',
    'home.tile_nvda': 'إشارة AI: إعداد شراء قوي',
    'home.tile_spy': 'قراءة AI: سوق حيادي',
    'home.tile_cl': 'إشارة AI: بيع تكتيكي',
    'home.register_title': 'إنشاء حساب',
    'home.register_sub': 'انضم إلى متداولين يشاركون أفكارهم يوميا. مجاني دائما.',
    'home.step_register': 'تسجيل',
    'home.step_verify': 'تحقق',
    'home.step_done': 'تم',
    'home.full_name': 'الاسم الكامل',
    'home.username': 'اسم المستخدم',
    'home.username_hint': 'حروف وأرقام و _ فقط',
    'home.email': 'البريد الإلكتروني',
    'home.phone': 'الهاتف (أرقام فقط، حتى 10)',
    'home.send_code': 'إرسال رمز التحقق',
    'home.otp_sent': 'أرسلنا رمز من 6 أرقام إلى',
    'home.otp_code': 'رمز التحقق',
    'home.verify_account': 'تفعيل الحساب',
    'home.resend_code': 'إعادة إرسال الرمز',
    'home.verified': 'تم التحقق',
    'home.password_sent': 'تم إرسال كلمة المرور إلى بريدك الإلكتروني. استخدمها لتسجيل الدخول.',
    'home.enter_feed': 'الدخول إلى الخلاصة',
    'home.engine_title': 'محرك الإشارة المجاني',
    'home.engine_sub': 'أدخل أي رمز واحصل على إشارة شراء أو بيع فورية مع بيانات مباشرة. يمكنك حفظها في ملفك الشخصي، ولا تنشر تلقائيا في الخلاصة.',
    'home.analyze': 'تحليل',
    'home.save_profile': 'حفظ في ملفي',
    'home.pricing_eyebrow': 'تسعير بسيط',
    'home.pricing_title': 'اختر خطتك',
    'home.pricing_sub': 'ابدأ مجانا، ثم انتقل إلى Pro عندما تحتاج إلى قوة ذكاء اصطناعي غير محدودة.',
    'home.free': 'مجاني',
    'home.free_price': '0$',
    'home.forever': '/ دائما',
    'home.pro': 'Pro',
    'home.month': '/ شهر',
    'home.popular': 'الأكثر اختيارا',
    'home.join_free': 'انضم مجانا',
    'home.upgrade_pro': 'الترقية إلى Pro',
    'home.platform': 'المنصة',
    'home.why': 'لماذا SwingRush؟',
    'home.feature_live_title': 'بيانات مباشرة',
    'home.feature_live_text': 'أسعار مباشرة للأسهم والسلع والصناديق والعملات الرقمية.',
    'home.feature_wins_title': 'تتبع النتائج',
    'home.feature_wins_text': 'عند وصول التوصية إلى هدفها، تظهر نتيجتها بوضوح في الخلاصة.',
    'home.feature_alerts_title': 'تنبيهات المتابعة',
    'home.feature_alerts_text': 'تابع المتداولين الأقوى وتلق تنبيها عند نشر صفقة جديدة.',
    'home.feature_stats_title': 'إحصاءات أداء',
    'home.feature_stats_text': 'نسبة نجاح، عائد إجمالي، وتاريخ كامل لكل متداول.',
    'home.feature_engine_title': 'محرك إشارات',
    'home.feature_engine_text': 'إشارات شراء وبيع فورية مع هدف ربح ووقف خسارة.',
    'home.feature_assets_title': 'تغطية متعددة الأصول',
    'home.feature_assets_text': 'الأسهم والمعادن والطاقة والعملات الرقمية في مساحة سوق واحدة مركزة.',
    'home.feature_ai_title': 'محرك Pro بالذكاء الاصطناعي',
    'home.feature_ai_text': 'يجمع المؤشرات الفنية مع الأخبار والمحفزات والمخاطر.',
    'home.feature_scanner_title': 'ماسح 682 سهم',
    'home.feature_scanner_text': 'مسح تلقائي وترتيب للفرص حسب قوة الإشارة.',
    'home.modal_upgrade': 'الترقية إلى SwingRush Pro',
    'home.modal_copy': 'الدفع الإلكتروني قادم قريبا. حاليا، تواصل معنا للترقية:',
    'home.got_it': 'حسنا',
    'home.disclaimer': 'يوفر SwingRush تحليلات وإشارات تداول لأغراض معلوماتية وتعليمية فقط، ولا يعد نصيحة مالية. قد تحتوي أنظمة الذكاء الاصطناعي على أخطاء. قم دائما ببحثك الخاص واستشر مستشارا ماليا مرخصا قبل التداول.',

    'login.tagline': 'شبكة توصيات مالية',
    'login.title': 'دخول المتداول',
    'login.email': 'البريد الإلكتروني',
    'login.password': 'كلمة المرور',
    'login.button': 'الدخول إلى الخلاصة',
    'login.logging_in': 'جار تسجيل الدخول...',
    'login.sending': 'جار الإرسال...',
    'login.forgot': 'نسيت كلمة المرور؟',
    'login.forgot_copy': 'أدخل بريدك الإلكتروني وسنرسل لك كلمة مرور جديدة.',
    'login.send_password': 'إرسال كلمة مرور جديدة',
    'login.cancel': 'إلغاء',
    'login.new_trader': 'متداول جديد؟',
    'login.create': 'أنشئ حسابا مجانيا',

    'feed.notifications': 'الإشعارات',
    'feed.clear_all': 'مسح الكل',
    'feed.no_notifications': 'لا توجد إشعارات بعد',
    'feed.best_traders': 'أفضل المتداولين',
    'feed.win_rate': 'نسبة النجاح',
    'feed.total_return': 'العائد الإجمالي',
    'feed.workspace': 'مركز التداول',
    'feed.workspace_profile': 'الملف الشخصي',
    'feed.workspace_scanner': 'ماسح السوق',
    'feed.workspace_engine': 'محرك Pro',
    'feed.ai_engine': 'محرك Pro بالذكاء الاصطناعي',
    'feed.ai_engine_copy': 'تحليل Claude AI لأي سهم: فني + أخبار + محفزات.',
    'feed.open_ai': 'فتح محرك Pro',
    'feed.hot_stocks': 'أسهم ساخنة',
    'feed.live_market': 'السوق المباشر',
    'feed.live': 'مباشر',
    'feed.market_move': 'حركة السوق',
    'feed.call_return': 'عائد الصفقة',
    'feed.search_placeholder': 'ابحث عن رمز أو @مستخدم...',
    'feed.traders': 'متداولون',
    'feed.follow_instrument': 'متابعة الأداة',
    'feed.following_symbol': 'تتم المتابعة',
    'feed.market_sentiment': 'معنويات السوق',
    'feed.recent_calls': 'أحدث الصفقات',
    'feed.market_feed': 'خلاصة السوق',
    'feed.all_traders': 'كل المتداولين',
    'feed.following': 'المتابَعون',
    'feed.load_more': 'تحميل المزيد',

    'scanner.title': 'ماسح SwingRush',
    'scanner.sub': 'مسح مدعوم بالذكاء الاصطناعي للأسهم الأمريكية، مع ترتيب أفضل الفرص حسب النتيجة المركبة.',
    'scanner.scanned': 'تم مسحها:',
    'scanner.duration': 'المدة:',
    'scanner.updated': 'آخر تحديث:',
    'scanner.last_scan': 'آخر فحص مكتمل:',
    'scanner.next_scan': 'المسح التلقائي القادم:',
    'scanner.tab_all': 'أفضل 20 إجمالا',
    'scanner.tab_buy': 'أفضل 10 شراء',
    'scanner.tab_sell': 'أفضل 10 بيع',
    'scanner.run': 'تشغيل الماسح',
    'scanner.latest_result': 'أحدث نتيجة',
    'scanner.loading': 'جار التحميل...',
    'scanner.cached': 'آخر فحص مكتمل',
    'scanner.cached_short': 'آخر فحص مكتمل',
    'scanner.weekend_cache': 'آخر فحص مكتمل',
    'scanner.market_open': 'السوق مفتوح',
    'scanner.market_closed': 'السوق مغلق',
    'scanner.weekend': 'عطلة نهاية الأسبوع',
    'scanner.no_results': 'لا توجد نتائج لهذا الفلتر',
    'scanner.ready_title': 'مسح تلقائي',
    'scanner.ready_copy': 'يعرض الماسح تلقائيا آخر ترتيب مكتمل للسوق.',
    'scanner.ready_meta': 'يمسح كل 682 رمزا فنيا وإخباريا · يستغرق 45–60 دقيقة · يعمل كل 4 ساعات في أيام الأسبوع.',
    'scanner.score_title': 'دليل النتيجة',
    'scanner.score_copy': 'النتيجة مبنية على مؤشرات مثل RSI و EMA و MACD والحجم ومعنويات الأخبار.',
    'scanner.enriching': 'جار إثراء جميع الرموز بالأخبار المباشرة…',
    'scanner.technical_scanning': 'جار فحص الإشارات الفنية…',
    'scanner.news_progress': 'اكتمل الفحص الفني · {technical} / {total} رمز جاهز للأخبار · {done} / {ready} درجة أخبار مكتملة',
    'scanner.technical_progress': '{done} / {total} رمز تم تحليله فنياً',
    'scanner.starting': 'جار بدء فحص كامل السوق…',
    'scanner.news_enrichment': 'إثراء الأخبار ',
    'scanner.technical_scan': 'الفحص الفني ',
    'scanner.complete': 'مكتمل',
    'scanner.progress_note': 'كل رمز يحصل على تحليل فني وإخباري قبل الترتيب النهائي',
    'scanner.progress_wait': 'تظهر النتائج بعد اكتمال الفحص بالكامل',
    'scanner.refreshing': 'يتم عرض أحدث نتيجة محفوظة بينما يستمر التحديث المجدول تلقائيا.',
    'scanner.entry': 'الدخول',
    'scanner.take_profit': 'هدف الربح',
    'scanner.stop_loss': 'وقف الخسارة',
    'scanner.score_breakdown': 'تفصيل النتيجة',
    'scanner.technical': 'فني',
    'scanner.news': 'الأخبار',
    'scanner.total_score': 'النتيجة الإجمالية',
    'scanner.confidence': 'ثقة',
    'scanner.trend': 'الاتجاه',
    'scanner.timeframe': 'الإطار الزمني',
    'scanner.risk_reward': 'المخاطرة / العائد',
    'scanner.range_position': 'موقع النطاق',
    'scanner.rank': 'الترتيب',
    'scanner.of': 'من',
    'scanner.trade_plan': 'خطة الصفقة',
    'scanner.current_price': 'السعر الحالي',
    'scanner.score_summary': 'النتيجة المركبة',
    'scanner.market_snapshot': 'ملخص السوق',
    'scanner.opportunity': 'فرصة',
    'scanner.daily_change': 'التغير اليومي',
    'scanner.news_coverage': 'تغطية الأخبار',
    'scanner.articles': 'مقالات',
    'scanner.key_drivers': 'أهم المؤثرات',
    'scanner.research_details': 'تفاصيل البحث',
    'scanner.signals': 'إشارات',
    'scanner.technical_evidence': 'الدليل الفني',
    'scanner.news_evidence': 'دليل الأخبار',
    'scanner.no_news': 'لا توجد عناصر أخبار حديثة',
    'scanner.news_item': 'خبر السوق',
    'scanner.analyst': 'المحللون',
    'scanner.pro_analyze': 'حلل مع Pro Engine',

    'profile.share_call': 'مشاركة صفقة',
    'profile.workspace': 'مساحة التداول',
    'profile.your_workspace': 'مساحة التداول الخاصة بك',
    'profile.trader_workspace': 'مساحة المتداول',
    'profile.snapshot_status': 'حالة الحساب',
    'profile.snapshot_calls': 'الصفقات المتابعة',
    'profile.snapshot_return': 'صافي عائد الصفقات',
    'profile.snapshot_live': 'بيانات سوق مباشرة',
    'profile.trader_profile': 'ملفي كمتداول',
    'profile.password': 'كلمة المرور',
    'profile.follow': 'متابعة',
    'profile.following_action': 'تتم المتابعة',
    'profile.follow_back': 'متابعة متبادلة',
    'profile.share_title': 'مشاركة صفقة',
    'profile.share_copy': 'يتم جلب سعر الدخول مباشرة، ويصل التنبيه للمتابعين فورا.',
    'profile.symbol': 'الرمز',
    'profile.take_profit': 'هدف الربح ($)',
    'profile.stop_loss': 'وقف الخسارة ($)',
    'profile.optional': 'اختياري',
    'profile.note': 'ملاحظة',
    'profile.note_hint': 'أطروحتك...',
    'profile.post_feed': 'نشر في الخلاصة',
    'profile.following': 'المتابَعون',
    'profile.followers': 'المتابعون',
    'profile.performance': 'إحصاءات الأداء',
    'profile.total_calls': 'إجمالي الصفقات',
    'profile.win_rate': 'نسبة النجاح',
    'profile.total_return': 'العائد الإجمالي',
    'profile.overall_pl': 'الربح/الخسارة الإجمالي',
    'profile.open_pl': 'الربح/الخسارة المفتوح',
    'profile.closed_pl': 'الربح/الخسارة المغلق',
    'profile.open_calls': 'صفقات مفتوحة',
    'profile.my_trades': 'صفقاتي',
    'profile.filter_all': 'كل الصفقات',
    'profile.filter_open': 'الصفقات المفتوحة',
    'profile.filter_closed': 'الصفقات المغلقة',
    'profile.my_recs': 'توصياتي',
    'profile.reposts': 'إعادة النشر',
    'profile.watchlist': 'الأدوات المتابعة',
    'profile.engine_signals': 'إشارات المحرك',
    'profile.private': 'خاص',
    'profile.change_password': 'تغيير كلمة المرور',
    'profile.current_password': 'كلمة المرور الحالية',
    'profile.new_password': 'كلمة المرور الجديدة',
    'profile.confirm_password': 'تأكيد كلمة المرور',
    'profile.update_password': 'تحديث كلمة المرور'
    ,
    'paywall.close': 'إغلاق',
    'paywall.free_access': 'دخول مجاني',
    'paywall.register_title': 'أنشئ مساحة التداول الخاصة بك.',
    'paywall.register_copy': 'أنشئ حسابا مجانيا لحفظ صفقاتك ومتابعة السوق والاحتفاظ بكل قرار في مساحة عمل واضحة.',
    'paywall.free_engine': 'تحليل واحد بمحرك الإشارات لتقييم فرصتك',
    'paywall.free_scanner': 'أحدث مسح سوق مرتب وخلاصة سوق مباشرة',
    'paywall.free_profile': 'سجل الصفقات وتتبع الأداء وشبكة المتداولين',
    'paywall.create': 'إنشاء حساب مجاني',
    'paywall.login': 'تسجيل الدخول إلى حسابك',
    'paywall.later': 'متابعة الاستكشاف',
    'paywall.engine_title': 'استمر في العمل مع محلل الذكاء الاصطناعي.',
    'paywall.chat_title': 'حافظ على مكتب الذكاء الاصطناعي مفتوحا.',
    'paywall.engine_copy': 'لقد استهلكت تحليلك المجاني. Pro يحافظ على سير البحث دون سقف استخدام.',
    'paywall.chat_copy': 'انتهت رسائل الذكاء الاصطناعي المجانية. يمنحك Pro شريكا للسوق يعمل دائما.',
    'paywall.pro_access': 'ذكاء Pro',
    'paywall.always_on': '24 / 7',
    'paywall.pro_plan': 'SWINGRUSH PRO',
    'paywall.month': '/ شهر',
    'paywall.cancel': 'إلغاء في أي وقت',
    'paywall.pro_ai': 'محرك إشارات ومحادثة AI بلا حدود',
    'paywall.pro_scanner': 'ماسح كامل مرتب مع سياق بحث مباشر',
    'paywall.pro_network': 'تابع المتداولين والأدوات ونتائج الصفقات مباشرة',
    'paywall.pro_risk': 'سير عمل الدخول والهدف والمخاطر في مكان واحد',
    'paywall.start_pro': 'طلب دخول Pro',
    'paywall.contact_note': 'إعداد الدفع الآمن يتم مع فريق SwingRush.',
    'paywall.contact': 'دخول Pro: تواصل مع swingrush.admin@gmail.com.'
  };

  const api = {
    lang: localStorage.getItem('sr_lang') || 'en',
    t(key, fallback) {
      return api.lang === 'ar' ? (AR[key] || fallback || key) : (fallback || key);
    },
    set(lang) {
      api.lang = lang === 'ar' ? 'ar' : 'en';
      localStorage.setItem('sr_lang', api.lang);
      apply();
    },
    toggle() {
      api.set(api.lang === 'ar' ? 'en' : 'ar');
    }
  };

  function store(el, attr, key) {
    const name = 'i18nOriginal' + key;
    if (el.dataset[name] === undefined) el.dataset[name] = el.getAttribute(attr) || '';
    return el.dataset[name];
  }

  function applyText(el) {
    const key = el.dataset.i18n;
    if (el.dataset.i18nOriginalText === undefined) el.dataset.i18nOriginalText = el.textContent;
    const original = el.dataset.i18nOriginalText;
    el.textContent = api.lang === 'ar' ? (AR[key] || original) : original;
  }

  function applyHtml(el) {
    const key = el.dataset.i18nHtml;
    if (el.dataset.i18nOriginalHtml === undefined) el.dataset.i18nOriginalHtml = el.innerHTML;
    el.innerHTML = api.lang === 'ar' ? (AR[key] || el.dataset.i18nOriginalHtml) : el.dataset.i18nOriginalHtml;
  }

  function applyAttr(el, attr, dataKey, originalKey) {
    const key = el.dataset[dataKey];
    if (el.dataset[originalKey] === undefined) el.dataset[originalKey] = el.getAttribute(attr) || '';
    el.setAttribute(attr, api.lang === 'ar' ? (AR[key] || el.dataset[originalKey]) : el.dataset[originalKey]);
  }

  function mountToggle() {
    const nav = document.querySelector('.navbar-actions');
    if (!nav || document.getElementById('sr-lang-toggle')) return;
    const btn = document.createElement('button');
    btn.id = 'sr-lang-toggle';
    btn.type = 'button';
    btn.className = 'btn btn-outline btn-sm lang-toggle';
    btn.setAttribute('aria-label', 'Change language');
    btn.addEventListener('click', api.toggle);
    nav.insertBefore(btn, nav.firstChild);
  }

  function apply() {
    document.documentElement.lang = api.lang;
    document.documentElement.dir = api.lang === 'ar' ? 'rtl' : 'ltr';
    document.body && document.body.classList.toggle('rtl', api.lang === 'ar');

    document.querySelectorAll('[data-i18n]').forEach(applyText);
    document.querySelectorAll('[data-i18n-html]').forEach(applyHtml);
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => applyAttr(el, 'placeholder', 'i18nPlaceholder', 'i18nOriginalPlaceholder'));
    document.querySelectorAll('[data-i18n-title]').forEach(el => applyAttr(el, 'title', 'i18nTitle', 'i18nOriginalTitle'));

    document.querySelectorAll('.lang-toggle').forEach(btn => {
      btn.textContent = api.lang === 'ar' ? '🇬🇧' : '🇦🇪';
      btn.title = api.t('nav.language', 'Change language');
      btn.setAttribute('aria-label', btn.title);
    });

    window.dispatchEvent(new CustomEvent('sr:language_changed', { detail: { lang: api.lang } }));
  }

  window.SRLang = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mountToggle();
      apply();
    });
  } else {
    mountToggle();
    apply();
  }
})();
