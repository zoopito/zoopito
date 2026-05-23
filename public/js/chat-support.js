/**
 * Zoopito AI Chat Support Widget v2
 * Role-aware • Conversational • Smart fallback
 */

(function () {
  'use strict';

  // ─── Role & User ──────────────────────────────────────────────────────────
  const userRole = (window.ZOOPITO_USER_ROLE || 'GUEST').toUpperCase();
  const userName  = (window.ZOOPITO_USER_NAME  || '').trim();
  const isLoggedIn = userName && userName !== 'there' && userName !== '';
  const displayName = isLoggedIn ? userName : null;

  // ─── Role Theme Config ────────────────────────────────────────────────────
  const ROLE_CONFIG = {
    FARMER:  { label:'Farmer',   color:'#16a34a', gradient:'linear-gradient(135deg,#16a34a,#15803d)', accent:'#bbf7d0', msgBg:'#dcfce7', msgText:'#14532d', replyBg:'#f0fdf4', icon:'🌾' },
    PARAVET: { label:'Para-Vet', color:'#0369a1', gradient:'linear-gradient(135deg,#0369a1,#0284c7)', accent:'#bae6fd', msgBg:'#dbeafe', msgText:'#1e3a5f', replyBg:'#eff6ff', icon:'🩺' },
    SALES:   { label:'Sales',    color:'#7c3aed', gradient:'linear-gradient(135deg,#7c3aed,#6d28d9)', accent:'#ddd6fe', msgBg:'#ede9fe', msgText:'#3b0764', replyBg:'#f5f3ff', icon:'📊' },
    ADMIN:   { label:'Admin',    color:'#b45309', gradient:'linear-gradient(135deg,#b45309,#d97706)', accent:'#fde68a', msgBg:'#fef3c7', msgText:'#451a03', replyBg:'#fffbeb', icon:'⚙️' },
    GUEST:   { label:'Guest',    color:'#374151', gradient:'linear-gradient(135deg,#374151,#4b5563)', accent:'#e5e7eb', msgBg:'#e5e7eb', msgText:'#111827', replyBg:'#f9fafb', icon:'💬' },
  };
  const cfg = ROLE_CONFIG[userRole] || ROLE_CONFIG.GUEST;

  // ─── Live helpers ─────────────────────────────────────────────────────────
  function getLiveTime() {
    return new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });
  }
  function getLiveDate() {
    return new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  }
  function getGreetingWord() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ─── Dynamic answer builders ──────────────────────────────────────────────
  function greetingAnswer() {
    const g = getGreetingWord();
    const name = displayName ? `, <strong>${displayName}</strong>` : '';
    return `${g}${name}! 😊 How can I help you today? Ask me anything about Zoopito!`;
  }
  function byeAnswer() {
    const name = displayName ? ` <strong>${displayName}</strong>` : '';
    return `Goodbye${name}! 👋 Have a great day. Come back anytime you need help with Zoopito!`;
  }
  function thanksAnswer() {
    return pick([
      `You're most welcome! 😊 Glad I could help. Is there anything else you'd like to know?`,
      `Happy to help! 🙌 Feel free to ask if you have more questions.`,
      `Anytime! That's what I'm here for. 😄`,
    ]);
  }
  function whoAmIAnswer() {
    return `I'm <strong>Zoopito Assistant</strong> 🤖 — an AI-powered support bot built specifically for the Zoopito livestock management platform.<br><br>I can help you with:<br>• Platform navigation & features<br>• Vaccinations, animals, reports<br>• Role-specific tasks<br>• Contact & support info<br><br>I'm not a human, but I try my best to be helpful! 😊`;
  }
  function whatIEatAnswer() {
    return pick([
      `Ha! I'm an AI, so I run on <strong>electricity and data</strong> ⚡ — no food for me! But I'm here to make sure your livestock get proper nutrition and care 🌾`,
      `I eat… <strong>questions!</strong> 😄 The more you ask, the better I get. Feed me your queries!`,
      `As a digital assistant, I survive on <strong>0s and 1s</strong> 💻. But Zoopito is all about making sure your animals are well-fed and healthy! 🐄`,
    ]);
  }
  function timeAnswer() {
    return `🕐 Current time: <strong>${getLiveTime()}</strong><br>📅 Today is: <strong>${getLiveDate()}</strong>`;
  }
  function dateAnswer() {
    return `📅 Today is <strong>${getLiveDate()}</strong><br>🕐 Current time: <strong>${getLiveTime()}</strong>`;
  }
  function whoAreYouAnswer() {
    return whoAmIAnswer();
  }
  function aboutMeAnswer() {
    if (!isLoggedIn) {
      return `I can see you're not logged in right now. 🔐<br><br>Please <a href="/users/login" class="chat-link">Login →</a> to your Zoopito account and I'll be able to tell you more about your profile, role, and activities!`;
    }
    const roleLabels = { FARMER:'Farmer 🌾', PARAVET:'Para-Vet 🩺', SALES:'Sales Representative 📊', ADMIN:'Administrator ⚙️', GUEST:'Guest' };
    return `Here's what I know about you:<br><br>
👤 <strong>Name:</strong> ${displayName}<br>
🎭 <strong>Role:</strong> ${roleLabels[userRole] || userRole}<br>
🟢 <strong>Status:</strong> Logged in<br><br>
For more details like contact info and account settings, visit your <a href="/users/profile" class="chat-link">Profile →</a>`;
  }
  function loginPromptAnswer() {
    return `Oops! Lagta hai aap abhi <strong>logged in nahi hain</strong>. 🔐<br><br>Please <a href="/users/login" class="chat-link">Login karo →</a> apne Zoopito account mein — phir main aapki poori madad kar sakta hoon! 😊`;
  }
  function jokeAnswer() {
    const jokes = [
      `Why did the cow go to space? 🐄🚀<br>Because it wanted to see the <strong>Milky Way</strong>! 😄`,
      `What do you call a sleeping cow? 🐄💤<br>A <strong>bulldozer</strong>! 😂`,
      `Why don't cows ever have money? 💸<br>Because farmers always <strong>milk them dry</strong>! 😄`,
      `What did the farmer say to the cow? 🌾<br>"You are <strong>out-standing</strong> in your field!" 😎`,
    ];
    return pick(jokes);
  }
  function helpAnswer() {
    const roleHelp = {
      FARMER: `Here's what I can help you with as a Farmer 🌾:<br>• Add/view your animals<br>• Check vaccination schedules<br>• Contact your paravet<br>• Report sick animals<br>• Navigate your dashboard`,
      PARAVET: `Here's what I can help you with as a Para-Vet 🩺:<br>• View assigned farmers<br>• Log vaccinations<br>• Submit daily reports<br>• Check animals needing care<br>• Manage your schedule`,
      SALES: `Here's what I can help you with as a Sales Rep 📊:<br>• Onboard new farmers<br>• View your farmer list<br>• Check KPIs & targets<br>• View paravets in your zone`,
      ADMIN: `Here's what I can help you with as Admin ⚙️:<br>• Manage all users & roles<br>• View vaccination compliance<br>• Check activity logs<br>• Platform settings & config`,
      GUEST: `Here's what I can help you with:<br>• Learn about Zoopito<br>• Contact support<br>• View services<br>• Password & login help`,
    };
    return (roleHelp[userRole] || roleHelp.GUEST) + `<br><br>Just type your question and I'll answer! 😊`;
  }
  function sorryAnswer() {
    return pick([
      `No worries at all! 😊 How can I help you?`,
      `Everything's fine! Don't apologize. What can I do for you?`,
      `It's okay! Let me know what you need help with.`,
    ]);
  }
  function niceAnswer() {
    return pick([
      `Thank you! 😊 You're very kind! Now, how can I assist you today?`,
      `Aww, that's sweet! 🙏 Is there something I can help you with?`,
    ]);
  }
  function sadAnswer() {
    const name = displayName ? ` ${displayName}` : '';
    return `I'm sorry to hear that${name}. 😔 I hope things get better soon!<br><br>If there's anything Zoopito-related I can help with, I'm right here. Is everything okay with your account or animals?`;
  }
  function boredAnswer() {
    return `Let me cheer you up! 😄<br><br>Did you know Zoopito has helped manage health records for <strong>thousands of animals</strong> across India? 🐄🐐🐑<br><br>Want to explore the platform? Here's your <a href="${userRole === 'GUEST' ? '/' : `/${userRole.toLowerCase()}/dashboard`}" class="chat-link">Dashboard →</a>`;
  }
  function weatherAnswer() {
    return `I'm not connected to a weather service, but I can tell you it's a great day to check on your livestock! 🌤️<br><br>For weather, try <a href="https://weather.com" target="_blank" class="chat-link">weather.com →</a> or Google Weather.`;
  }
  function loveAnswer() {
    return pick([
      `Aww, love you too! 💚 (in a professional AI way, of course!) Now how can I help you with Zoopito? 😄`,
      `That's very sweet! 🙏 I care about helping you too! What do you need?`,
    ]);
  }
  function randomLetterAnswer(input) {
    const clean = input.trim();
    if (clean.length === 1) {
      return `"<strong>${clean.toUpperCase()}</strong>" — that's a letter, not a question! 😄<br><br>Try asking me something like:<br>• "How do I add an animal?"<br>• "What time is it?"<br>• "Contact support"<br><br>I'm here to help! 🙏`;
    }
    return null;
  }
  function randomNumberAnswer(input) {
    if (/^\d+$/.test(input.trim())) {
      return `<strong>${input.trim()}</strong> — that's a number! 🔢 Are you looking for something specific?<br><br>Try asking me a question in plain English. I'm here to help with Zoopito! 😊`;
    }
    return null;
  }
  function singleWordChatter(q) {
    const map = {
      'ok': `Great! 👍 Anything else I can help you with?`,
      'okay': `Okay! 😊 Let me know if you need anything.`,
      'yes': `Sure thing! What would you like to know?`,
      'no': `Alright! Feel free to ask anything anytime. 😊`,
      'hmm': `Take your time! I'm here whenever you're ready. 😊`,
      'hm': `Take your time! I'm here whenever you're ready. 😊`,
      'lol': `Haha! 😄 Glad to bring a smile. Anything I can help with?`,
      'haha': `😄 Having fun! Now, anything Zoopito-related I can assist with?`,
      'wow': `Yes, Zoopito is pretty amazing! 😎 What would you like to explore?`,
      'cool': `Glad you think so! 😎 What else can I help you with?`,
      'nice': niceAnswer(),
      'thanks': thanksAnswer(),
      'thank': thanksAnswer(),
      'bye': byeAnswer(),
      'hi': greetingAnswer(),
      'hey': greetingAnswer(),
      'hello': greetingAnswer(),
      'helo': greetingAnswer(),
      'hii': greetingAnswer(),
      'hiii': greetingAnswer(),
      'heya': greetingAnswer(),
      'help': helpAnswer(),
    };
    return map[q] || null;
  }

  // ─── Knowledge Base ───────────────────────────────────────────────────────
  const KB = {

    // ── Conversational / Small-talk ──────────────────────────────────────────
    chit: [
      // Greetings
      { q:['good morning','good afternoon','good evening','good night','subah','namaste','namaskar','good day'], fn: greetingAnswer },
      { q:['hi there','hello there','hey there','hiya','howdy','greetings','sup','what\'s up','whats up','wassup','how are you','how r u','how are u','kya haal','kaisa hai','kaise ho'], fn: () => {
        const name = displayName ? `, <strong>${displayName}</strong>` : '';
        return `${getGreetingWord()}${name}! 😊 I'm doing great and ready to help!<br><br>What can I assist you with today?`;
      }},

      // Farewells
      { q:['bye','goodbye','good bye','see you','see ya','take care','later','alvida','cya','tata','bbye','byee'], fn: byeAnswer },
      { q:['good night','shubh ratri','shukriya raat'], fn: () => `Good night! 🌙 Sleep well. Your animals are in safe hands with Zoopito! 🐄` },

      // Thanks
      { q:['thank you','thanks','thankyou','thx','ty','shukriya','dhanyawad','bahut dhanyawad','thanks a lot','thank u'], fn: thanksAnswer },

      // Sorry / Apologies
      { q:['sorry','i am sorry','my bad','oops','apologies','maaf karo','maafi'], fn: sorryAnswer },

      // Who is the bot
      { q:['who are you','who r u','who made you','what are you','are you a robot','are you ai','are you human','are you real','aap kaun ho','tumhara naam','your name','what is your name','whats your name'], fn: whoAreYouAnswer },
      { q:['what do you eat','what do you drink','do you eat','do you sleep','do you have feelings','do you feel','are you alive','kya khate ho'], fn: whatIEatAnswer },

      // Time & Date
      { q:['what time is it','current time','time now','abhi time kya hai','time batao','what is the time','tell me the time','kitna baja hai','baj gaye','baje','clock'], fn: timeAnswer },
      { q:['what day is it','today date','what is today','today\'s date','aaj kya date hai','aaj ka din','what is the date','date batao','current date','which day'], fn: dateAnswer },

      // About the user
      { q:['what do you know about me','tell me about myself','who am i','mera naam','my name','mere baare mein','know about me','my profile','my info','my account'], fn: aboutMeAnswer },

      // Not logged in prompts
      { q:['login karo','please login','login first','log in first','sign in'], fn: loginPromptAnswer },

      // Jokes & Fun
      { q:['tell me a joke','joke sunao','joke batao','make me laugh','something funny','funny','joke'], fn: jokeAnswer },

      // Love & Compliments
      { q:['i love you','love you','love zoopito','pyaar','i like you'], fn: loveAnswer },
      { q:['you are great','you are awesome','you are amazing','great job','well done','good job','bahut accha','shabash'], fn: niceAnswer },

      // Sad / Emotions
      { q:['i am sad','feeling sad','not good','bad day','i am not okay','not okay','bohot bura lag raha','mujhe dukh','depressed'], fn: sadAnswer },
      { q:['i am bored','bored','kuch nahi karna','pareshaan','bore ho gaya'], fn: boredAnswer },

      // Weather
      { q:['weather','what is the weather','how is the weather','mausam','rain today','will it rain'], fn: weatherAnswer },

      // Help
      { q:['help','help me','help karo','madad','what can you do','what can you help with','kya kar sakte ho'], fn: helpAnswer },

      // Nonsense / gibberish catchers
      { q:['asdf','qwerty','zxcv','asdfjkl','blah','blah blah','test','testing','123','abc'], fn: () => `Looks like you might be testing me! 😄<br><br>I'm fully operational and ready to help. Try asking:<br>• "What is Zoopito?"<br>• "How do I add an animal?"<br>• "Contact support"` },
    ],

    // ── Common Platform ────────────────────────────────────────────────────
    general: [
      { q:['what is zoopito','about zoopito','zoopito platform','what does zoopito do','explain zoopito','zoopito kya hai'], a:`<strong>Zoopito</strong> is an integrated livestock intelligence platform connecting <span class="tag farmer">Farmers 🌾</span>, <span class="tag paravet">Para-Vets 🩺</span>, and <span class="tag sales">Sales Teams 📊</span> under one ecosystem.<br><br>Key features:<br>• AI-driven animal health tracking<br>• Vaccination scheduling & management<br>• Real-time field reporting<br>• Role-based dashboards<br>• Government compliance tools` },
      { q:['contact','reach you','support team','helpline','phone number','email support','customer care'], a:`📞 <strong>Support Hotline:</strong> <a href="tel:+919511828322" class="chat-link">+91 95118 28322</a><br>📧 <strong>Email:</strong> <a href="mailto:support@zoopito.in" class="chat-link">support@zoopito.in</a><br>💬 <strong>WhatsApp:</strong> <a href="https://wa.me/919511828322" target="_blank" class="chat-link">Chat on WhatsApp</a><br><br>Support hours: Mon–Sat, 9 AM – 6 PM IST` },
      { q:['privacy','data security','my data safe','gdpr','data policy'], a:`Your data is protected with <strong>256-bit SSL encryption</strong> and is GDPR compliant. We never sell your data. <a href="/privacy-policy" class="chat-link">Privacy Policy →</a>` },
      { q:['login problem','cant login','forgot password','reset password','password reset','login nahi ho raha','password bhool gaya'], a:`To reset your password:<br>1. Go to <a href="/users/forgot-password" class="chat-link">Forgot Password →</a><br>2. Enter your registered email<br>3. Check your inbox for the reset link<br><br>Still stuck? Email <a href="mailto:support@zoopito.in" class="chat-link">support@zoopito.in</a>` },
      { q:['profile','update profile','change name','edit profile','my details'], a:`Update your profile at <a href="/users/profile" class="chat-link">My Profile →</a> from the top navigation. You can change your name, contact details, and preferences.` },
      { q:['terms','terms of service','terms and conditions'], a:`Read our full <a href="/terms-conditions" class="chat-link">Terms of Service →</a>` },
      { q:['services','what services','offerings','kya services'], a:`Zoopito offers livestock data management, vaccination campaigns, paravet field visit tracking, farmer onboarding, animal health records, and reporting dashboards. <a href="/services" class="chat-link">See all Services →</a>` },
      { q:['how to sign up','signup','create account','register','join zoopito','new account'], a:`To join Zoopito:<br>• <strong>Farmers</strong> — your Sales Rep registers you<br>• <strong>Para-Vets & Sales</strong> — registered by Admin<br><br>Contact: <a href="tel:+919511828322" class="chat-link">+91 95118 28322</a>` },
      { q:['app','mobile app','download app','android','ios','zoopito app'], a:`Zoopito is a web-based platform accessible from any browser on mobile or desktop. No separate app download needed — just visit <a href="https://zoopito.in" class="chat-link">zoopito.in →</a>` },
      { q:['about us','team','founders','company','zoopito company'], a:`Zoopito is built by a team passionate about transforming livestock management in India through technology. <a href="/about" class="chat-link">Learn more about us →</a>` },
      { q:['feedback','suggestion','report bug','bug report','complaint'], a:`We love feedback! 🙏<br>• <a href="/contact" class="chat-link">Submit Feedback →</a><br>• Email: <a href="mailto:support@zoopito.in" class="chat-link">support@zoopito.in</a>` },
      { q:['free','cost','price','pricing','kitna lagta hai','charges','fee','paid'], a:`Please contact our team for pricing details:<br>📞 <a href="tel:+919511828322" class="chat-link">+91 95118 28322</a><br>📧 <a href="mailto:support@zoopito.in" class="chat-link">support@zoopito.in</a>` },
    ],

    // ── Farmer ────────────────────────────────────────────────────────────
    FARMER: [
      { q:['add animal','register animal','new animal','how to add livestock','pashu jodna','naya pashu'], a:`To add a new animal:<br>1. Go to <a href="/farmer/animals" class="chat-link">My Animals →</a><br>2. Click <strong>"Add Animal"</strong><br>3. Fill species, breed, age, tag ID<br>4. Submit — your paravet will be notified` },
      { q:['vaccination','vaccine schedule','when vaccination','vaccination due','teeka','tikka'], a:`Your vaccination schedule is auto-generated based on animal age & species. Check it at <a href="/farmer/vaccinations" class="chat-link">Vaccination Schedule →</a>. Your assigned paravet will visit for the actual vaccination.` },
      { q:['paravet contact','my paravet','vet visit','paravet visit','doctor','pashu doctor'], a:`Your assigned paravet is shown in your <a href="/farmer/dashboard" class="chat-link">Dashboard →</a>. View scheduled visits, request visits, and track activity logs from there.` },
      { q:['my animals','view animals','livestock list','mera pashu','all animals'], a:`View all your registered animals at <a href="/farmer/animals" class="chat-link">My Animals →</a>. Filter by species, health status, and vaccination status.` },
      { q:['dashboard','farmer dashboard','home page','ghar','main page'], a:`Your <a href="/farmer/dashboard" class="chat-link">Farmer Dashboard →</a> shows animal summary, upcoming vaccinations, recent paravet activities, and health alerts.` },
      { q:['report problem','sick animal','animal sick','health issue','emergency','bimar pashu','pashu bimar'], a:`If an animal is sick:<br>1. Go to <a href="/farmer/animals" class="chat-link">My Animals →</a><br>2. Select the animal<br>3. Click <strong>"Report Health Issue"</strong><br><br>Emergency: <a href="tel:+919511828322" class="chat-link">+91 95118 28322</a>` },
      { q:['how register','how to join','signup farmer','create account'], a:`Your Sales Representative will register you on the platform. Call <a href="tel:+919511828322" class="chat-link">+91 95118 28322</a> for help.` },
    ],

    // ── Paravet ───────────────────────────────────────────────────────────
    PARAVET: [
      { q:['my farmers','assigned farmers','farmer list','view farmers','mera farmer'], a:`View your assigned farmers at <a href="/paravet/farmers" class="chat-link">My Farmers →</a>. Click any farmer to see their animal list, health history, and due vaccinations.` },
      { q:['vaccination record','log vaccination','complete vaccination','mark vaccination done','teeka lagana'], a:`To record a vaccination:<br>1. Go to <a href="/paravet/vaccinations" class="chat-link">Vaccinations →</a><br>2. Select the pending vaccination<br>3. Fill dose details and confirm<br>4. Upload a photo for verification` },
      { q:['animal needing care','sick animals','animals needing attention','bimar pashu'], a:`Check <a href="/paravet/animals/needing-care" class="chat-link">Animals Needing Care →</a> for a prioritized list across all your assigned farmers.` },
      { q:['schedule visit','plan visit','upcoming visits','field schedule','visit plan karna'], a:`Manage your visit schedule at <a href="/paravet/schedules" class="chat-link">My Schedule →</a>.` },
      { q:['report','daily report','activity report','submit report','riport'], a:`Submit your daily field report at <a href="/paravet/reports/daily" class="chat-link">Daily Report →</a>. Include animals visited, vaccinations done, and health observations.` },
      { q:['dashboard','paravet dashboard','home','main page'], a:`Your <a href="/paravet/dashboard" class="chat-link">Para-Vet Dashboard →</a> shows today's tasks, pending vaccinations, farmer alerts, and performance stats.` },
      { q:['bulk vaccination','mass vaccination','multiple animals vaccinate','bahut saare pashu'], a:`For bulk vaccinations, go to <a href="/paravet/vaccinations/bulk" class="chat-link">Bulk Vaccination →</a>.` },
      { q:['task','my tasks','pending tasks','assigned tasks','kaam'], a:`View all tasks at <a href="/paravet/tasks" class="chat-link">My Tasks →</a>. Includes field visits, vaccination campaigns, and health audits.` },
    ],

    // ── Sales ─────────────────────────────────────────────────────────────
    SALES: [
      { q:['add farmer','onboard farmer','register farmer','new farmer','farmer jodna'], a:`To onboard a new farmer:<br>1. Go to <a href="/sales/farmers" class="chat-link">My Farmers →</a><br>2. Click <strong>"Add Farmer"</strong><br>3. Fill personal details, village, livestock count<br>4. Submit — admin will assign a paravet` },
      { q:['my farmers','farmer list','assigned farmers','mera farmer list'], a:`Your farmer list is at <a href="/sales/farmers" class="chat-link">My Farmers →</a>. View onboarding status, animal counts, and paravet assignments.` },
      { q:['sales dashboard','dashboard','my targets','target'], a:`Your <a href="/sales/index" class="chat-link">Sales Dashboard →</a> shows farmer onboarding stats, coverage area, monthly targets, and performance metrics.` },
      { q:['paravet','view paravets','paravet list','doctor list'], a:`View active paravets in your zone at <a href="/sales/paravets" class="chat-link">Para-Vets →</a>.` },
      { q:['target','monthly target','performance','my kpi','kpi'], a:`Check your KPIs and monthly onboarding targets in your <a href="/sales/index" class="chat-link">Sales Dashboard →</a>.` },
      { q:['animal','farmer animals','livestock data','pashu data'], a:`View animals registered by your farmers at <a href="/sales/animals" class="chat-link">Animals →</a>.` },
    ],

    // ── Admin ─────────────────────────────────────────────────────────────
    ADMIN: [
      { q:['manage users','user management','all users','sabhi users'], a:`Manage all users at <a href="/admin/users" class="chat-link">User Management →</a>. View, edit, deactivate, or reassign roles.` },
      { q:['add sales','create sales rep','onboard sales','naya sales'], a:`Add a new Sales Representative at <a href="/admin/addsales" class="chat-link">Add Sales Rep →</a>.` },
      { q:['add paravet','create paravet','onboard paravet','naya paravet'], a:`Add a new Para-Vet at <a href="/admin/addparavet" class="chat-link">Add Para-Vet →</a>.` },
      { q:['admin dashboard','dashboard','overview','sabhi data'], a:`Your <a href="/admin/dashboard" class="chat-link">Admin Dashboard →</a> shows platform-wide KPIs: farmers, animals, vaccinations, active paravets, and compliance stats.` },
      { q:['vaccinations','vaccination compliance','vaccination report','teeka'], a:`View all vaccination records at <a href="/admin/vaccinations" class="chat-link">Vaccination Management →</a>.` },
      { q:['animals','all animals','animal registry','sabhi pashu'], a:`View the complete animal registry at <a href="/admin/animals" class="chat-link">Animal Registry →</a>.` },
      { q:['farmers','all farmers','farmer management','sabhi farmers'], a:`Manage all registered farmers at <a href="/admin/farmers" class="chat-link">Farmer Management →</a>.` },
      { q:['settings','platform settings','system settings','configuration'], a:`Access platform settings at <a href="/admin/settings" class="chat-link">Settings →</a>.` },
      { q:['activity log','audit log','user activity','log dekho'], a:`View all activity and audit logs at <a href="/admin/activity-logs" class="chat-link">Activity Logs →</a>.` },
      { q:['payments','billing','subscription','payment'], a:`Manage billing and payments at <a href="/admin/payments" class="chat-link">Payments →</a>.` },
      { q:['paravets','paravet management','all paravets','sabhi paravet'], a:`Manage all para-vets at <a href="/admin/paravets" class="chat-link">Para-Vet Management →</a>.` },
      { q:['sales team','sales management','all sales reps','sales staff'], a:`Manage your sales team at <a href="/admin/sales-team" class="chat-link">Sales Team →</a>.` },
    ],
  };

  // ─── Suggestions per role ─────────────────────────────────────────────────
  const SUGGESTIONS = {
    FARMER:  ['Add an animal 🐄','Vaccination schedule 💉','My paravet 🩺','Sick animal help 🚨','What is Zoopito?'],
    PARAVET: ['My farmers 🌾','Log vaccination 💉','Daily report 📋','Needing care 🚨','My schedule 📅'],
    SALES:   ['Onboard farmer 🌾','My dashboard 📊','My farmer list','Targets & KPIs 🎯','View paravets 🩺'],
    ADMIN:   ['Platform overview ⚙️','Manage users 👥','Vaccination compliance 💉','Activity logs 📋','Add sales rep'],
    GUEST:   ['What is Zoopito?','Contact support 📞','View services','Login help 🔐','About us'],
  };

  // ─── Answer Engine ────────────────────────────────────────────────────────
  function getAnswer(rawInput) {
    const q = rawInput.toLowerCase().trim();

    // 1. Single char / random letter
    if (q.length === 1) return randomLetterAnswer(q);

    // 2. Pure number
    if (/^\d+$/.test(q)) return randomNumberAnswer(q);

    // 3. Single-word shortcuts
    const sw = singleWordChatter(q);
    if (sw) return sw;

    // 4. Chit-chat / conversational KB (fn-based)
    for (const entry of KB.chit) {
      if (entry.q.some(kw => q.includes(kw))) return entry.fn();
    }

    // 5. Role-specific KB
    const roleSrc = KB[userRole] || [];
    for (const entry of roleSrc) {
      if (entry.a && entry.q.some(kw => q.includes(kw))) return entry.a;
    }

    // 6. General platform KB
    for (const entry of KB.general) {
      if (entry.q.some(kw => q.includes(kw))) return entry.a;
    }

    // 7. Fuzzy word match (words > 3 chars)
    const words = q.split(/\s+/).filter(w => w.length > 3);
    const allSrc = [...roleSrc, ...KB.general];
    for (const entry of allSrc) {
      if (entry.a && words.some(w => entry.q.some(kw => kw.includes(w)))) return entry.a;
    }
    // also fuzzy on chit
    for (const entry of KB.chit) {
      if (words.some(w => entry.q.some(kw => kw.includes(w)))) return entry.fn();
    }

    // 8. If not logged in and asks something personal
    if (!isLoggedIn && (q.includes('my') || q.includes('mera') || q.includes('meri'))) {
      return loginPromptAnswer();
    }

    return null;
  }

  // ─── Widget HTML ──────────────────────────────────────────────────────────
  function buildWidget() {
    const w = document.createElement('div');
    w.id = 'zp-chat-root';
    w.innerHTML = `
    <style>
      #zp-chat-root * { box-sizing: border-box; }
      #zp-fab {
        position: fixed; bottom: 90px; right: 20px; z-index: 9998;
        width: 52px; height: 52px; border-radius: 50%;
        background: ${cfg.gradient};
        color: #fff; border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.25);
        transition: transform 0.25s, box-shadow 0.25s;
        font-size: 20px;
      }
      #zp-fab:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(0,0,0,0.3); }
      #zp-fab .zp-badge {
        position: absolute; top: -4px; right: -4px;
        width: 16px; height: 16px; background: #ef4444;
        border-radius: 50%; border: 2px solid #fff;
        font-size: 9px; display: flex; align-items: center; justify-content: center;
        font-weight: 700; color: #fff;
      }
      #zp-panel {
        position: fixed; bottom: 150px; right: 20px; z-index: 9999;
        width: 340px; height:70vh; max-height: 70vh !important;
        background: #fff; border-radius: 16px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.18);
        display: flex; flex-direction: column;
        overflow: hidden; transform: scale(0.85) translateY(20px);
        opacity: 0; pointer-events: none;
        transition: transform 0.3s cubic-bezier(.34,1.56,.64,1), opacity 0.25s;
        font-family: 'Plus Jakarta Sans', sans-serif;
      }
      #zp-panel.open { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }
      .zp-head {
        padding: 12px 14px 10px; background: ${cfg.gradient};
        color: #fff; flex-shrink: 0; display: flex; align-items: center; gap: 10px;
      }
      .zp-head-avatar {
        width: 36px; height: 36px; border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex; align-items: center; justify-content: center;
        font-size: 17px; flex-shrink: 0;
      }
      .zp-head-info { flex: 1; min-width: 0; }
      .zp-head-name { font-size: 13px; font-weight: 700; line-height: 1.2; }
      .zp-head-sub { font-size: 10px; opacity: 0.85; display: flex; align-items: center; gap: 4px; }
      .zp-head-sub::before { content:''; width:6px; height:6px; border-radius:50%; background:#4ade80; flex-shrink:0; }
      .zp-head-close {
        width: 28px; height: 28px; border-radius: 50%;
        background: rgba(255,255,255,0.15); border: none; cursor: pointer;
        color: #fff; display: flex; align-items: center; justify-content: center;
        font-size: 14px; transition: background 0.2s;
      }
      .zp-head-close:hover { background: rgba(255,255,255,0.3); }
      .zp-role-badge {
        font-size: 9px; font-weight: 700; padding: 1px 7px;
        border-radius: 20px; background: rgba(255,255,255,0.22);
        letter-spacing: 0.04em; text-transform: uppercase;
      }
      .zp-msgs {
        flex: 1; overflow-y: auto; padding: 10px 12px;
        display: flex; flex-direction: column; gap: 8px;
        scroll-behavior: smooth;
      }
      .zp-msgs::-webkit-scrollbar { width: 3px; }
      .zp-msgs::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
      .zp-bubble {
        max-width: 88%; font-size: 12.5px; line-height: 1.52;
        padding: 8px 11px; border-radius: 14px;
        animation: zp-in 0.2s ease; word-break: break-word;
      }
      @keyframes zp-in { from { opacity:0; transform:translateY(6px);} to { opacity:1; transform:translateY(0);} }
      .zp-bubble.bot {
        background: ${cfg.replyBg}; color: #1f2937;
        border-bottom-left-radius: 4px; align-self: flex-start;
        border: 1px solid ${cfg.accent};
      }
      .zp-bubble.user {
        background: ${cfg.msgBg}; color: ${cfg.msgText};
        border-bottom-right-radius: 4px; align-self: flex-end; font-weight: 500;
      }
      .zp-bubble.typing {
        background: #f3f4f6; align-self: flex-start;
        border-bottom-left-radius: 4px; padding: 10px 14px;
      }
      .zp-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:#9ca3af; margin:0 1px; animation:zp-b 1.2s infinite; }
      .zp-dot:nth-child(2) { animation-delay:.2s; }
      .zp-dot:nth-child(3) { animation-delay:.4s; }
      @keyframes zp-b { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
      .zp-ts { font-size: 9.5px; color: #9ca3af; margin-top: 1px; }
      .zp-ts.right { align-self: flex-end; }
      .zp-ts.left  { align-self: flex-start; }
      .chat-link { color: ${cfg.color}; font-weight: 600; text-decoration: none; border-bottom: 1px solid ${cfg.accent}; }
      .chat-link:hover { opacity: 0.8; }
      .tag { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 10px; }
      .tag.farmer  { background:#dcfce7; color:#166534; }
      .tag.paravet { background:#dbeafe; color:#1e40af; }
      .tag.sales   { background:#ede9fe; color:#5b21b6; }
      .zp-suggest-wrap {
        padding: 6px 10px 8px; flex-shrink: 0;
        border-top: 1px solid #f3f4f6; background: #fafafa;
      }
      .zp-suggest-label { font-size: 9.5px; color: #9ca3af; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
      .zp-chips { display: flex; gap: 5px; flex-wrap: wrap; }
      .zp-chip {
        font-size: 11px; padding: 4px 9px; border-radius: 20px;
        background: #fff; border: 1px solid ${cfg.accent};
        color: ${cfg.color}; cursor: pointer; font-weight: 600;
        transition: background 0.15s, transform 0.15s;
        white-space: nowrap; font-family: inherit;
      }
      .zp-chip:hover { background: ${cfg.accent}; transform: scale(1.03); }
      .zp-input-row {
        display: flex; align-items: center; gap: 6px;
        padding: 8px 10px 10px; flex-shrink: 0;
        border-top: 1px solid #f3f4f6; background: #fff;
      }
      .zp-input {
        flex: 1; font-size: 12.5px; padding: 7px 11px;
        border: 1.5px solid #e5e7eb; border-radius: 20px;
        outline: none; font-family: inherit; color: #111827;
        background: #f9fafb; transition: border-color 0.2s;
      }
      .zp-input:focus { border-color: ${cfg.color}; background: #fff; }
      .zp-send {
        width: 34px; height: 34px; border-radius: 50%;
        background: ${cfg.gradient}; border: none; cursor: pointer;
        color: #fff; display: flex; align-items: center; justify-content: center;
        font-size: 13px; flex-shrink: 0; transition: transform 0.2s, box-shadow 0.2s;
      }
      .zp-send:hover { transform: scale(1.1); box-shadow: 0 3px 12px rgba(0,0,0,0.2); }
      .zp-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
      @media (max-width: 400px) {
        #zp-panel { width: calc(100vw - 20px); right: 10px; bottom: 130px; }
        #zp-fab { right: 16px; }
      }
    </style>

    <button id="zp-fab" title="Chat Support" aria-label="Open chat support">
      <i class="fas fa-comments"></i>
      <span class="zp-badge" id="zp-badge">1</span>
    </button>

    <div id="zp-panel" role="dialog" aria-label="Zoopito Support Chat">
      <div class="zp-head">
        <div class="zp-head-avatar">${cfg.icon}</div>
        <div class="zp-head-info">
          <div class="zp-head-name">Zoopito Assistant</div>
          <div class="zp-head-sub">Online &bull; Instant replies</div>
        </div>
        <span class="zp-role-badge">${cfg.label}</span>
        <button class="zp-head-close" id="zp-close" aria-label="Close chat">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="zp-msgs" id="zp-msgs"></div>
      <div class="zp-suggest-wrap">
        <div class="zp-suggest-label">Quick Topics</div>
        <div class="zp-chips" id="zp-chips"></div>
      </div>
      <div class="zp-input-row">
        <input id="zp-input" class="zp-input" type="text" placeholder="Ask anything…" autocomplete="off" maxlength="200" />
        <button id="zp-send" class="zp-send" aria-label="Send">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
    </div>
    `;
    document.body.appendChild(w);
  }

  // ─── UI Helpers ───────────────────────────────────────────────────────────
  function chatNow() {
    return new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
  }

  function addMsg(html, type) {
    const msgs = document.getElementById('zp-msgs');
    const b = document.createElement('div');
    b.className = `zp-bubble ${type}`;
    b.innerHTML = html;
    const ts = document.createElement('div');
    ts.className = `zp-ts ${type === 'user' ? 'right' : 'left'}`;
    ts.textContent = chatNow();
    msgs.appendChild(b);
    msgs.appendChild(ts);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    const msgs = document.getElementById('zp-msgs');
    const t = document.createElement('div');
    t.className = 'zp-bubble typing';
    t.id = 'zp-typing';
    t.innerHTML = '<span class="zp-dot"></span><span class="zp-dot"></span><span class="zp-dot"></span>';
    msgs.appendChild(t);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function hideTyping() { document.getElementById('zp-typing')?.remove(); }

  function sendMsg(text) {
    if (!text.trim()) return;
    document.getElementById('zp-input').value = '';
    document.getElementById('zp-send').disabled = true;
    addMsg(text, 'user');
    showTyping();
    const delay = 500 + Math.random() * 700;
    setTimeout(() => {
      hideTyping();
      const ans = getAnswer(text);
      addMsg(ans || `I don't have a specific answer for that. 🙏<br><br>
        📬 <a href="/contact" class="chat-link">Submit a Support Request →</a><br>
        📞 <a href="tel:+919511828322" class="chat-link">+91 95118 28322</a><br>
        📧 <a href="mailto:support@zoopito.in" class="chat-link">support@zoopito.in</a>`, 'bot');
      document.getElementById('zp-send').disabled = false;
      document.getElementById('zp-input').focus();
    }, delay);
  }

  function buildSuggestions(list) {
    const chips = document.getElementById('zp-chips');
    chips.innerHTML = '';
    list.forEach(s => {
      const c = document.createElement('button');
      c.className = 'zp-chip';
      c.textContent = s;
      c.addEventListener('click', () => sendMsg(s));
      chips.appendChild(c);
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    buildWidget();
    const fab    = document.getElementById('zp-fab');
    const panel  = document.getElementById('zp-panel');
    const close  = document.getElementById('zp-close');
    const input  = document.getElementById('zp-input');
    const send   = document.getElementById('zp-send');
    const badge  = document.getElementById('zp-badge');

    buildSuggestions(SUGGESTIONS[userRole] || SUGGESTIONS.GUEST);

    function openPanel() {
      panel.classList.add('open');
      badge.style.display = 'none';
      input.focus();
      if (!document.getElementById('zp-msgs').children.length) {
        setTimeout(() => {
          const g = getGreetingWord();
          const name = displayName ? `, <strong>${displayName}</strong>` : '';
          addMsg(`${g}${name}! 👋 I'm your Zoopito AI assistant.<br>Ask me <em>anything</em> — platform help, features, or just say hi! 😊`, 'bot');
        }, 200);
      }
    }

    function closePanel() { panel.classList.remove('open'); }

    fab.addEventListener('click', () => panel.classList.contains('open') ? closePanel() : openPanel());
    close.addEventListener('click', closePanel);
    send.addEventListener('click', () => sendMsg(input.value));
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(input.value); } });
    document.addEventListener('click', e => { if (!e.target.closest('#zp-chat-root')) closePanel(); });
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();