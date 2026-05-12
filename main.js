// تكوين Supabase (استبدل بالقيم الحقيقية)
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// التحقق من حالة المستخدم وتحديث واجهة الدخول
async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    const authDiv = document.getElementById('auth-buttons');
    if (user && authDiv) {
        // جلب صلاحية المستخدم
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        if (profile?.role === 'chief_editor') {
            authDiv.innerHTML = `<a href="admin.html" style="color:#c084fc;">لوحة التحكم</a> <a href="#" id="logoutBtn" style="color:#c084fc;">خروج</a>`;
            document.getElementById('logoutBtn')?.addEventListener('click', async () => {
                await supabase.auth.signOut();
                window.location.reload();
            });
        } else {
            authDiv.innerHTML = `<span>مرحباً ${user.email}</span> <a href="#" id="logoutBtn" style="color:#c084fc;">خروج</a>`;
            document.getElementById('logoutBtn')?.addEventListener('click', async () => {
                await supabase.auth.signOut();
                window.location.reload();
            });
        }
    }
}

// تحميل المقالات حسب الفئة
async function loadArticles(category = 'home') {
    const container = document.getElementById('cardsContainer');
    if (!container) return;
    let query = supabase
        .from('articles')
        .select('*, profiles(username)')
        .eq('published', true)
        .order('created_at', { ascending: false });
    if (category !== 'home') query = query.eq('category', category);
    const { data, error } = await query;
    if (error) { container.innerHTML = '<p>خطأ في التحميل</p>'; return; }
    if (data.length === 0) { container.innerHTML = '<p>لا توجد مقالات في هذا القسم</p>'; return; }
    container.innerHTML = data.map(article => `
        <div class="card">
            ${article.image ? `<img src="${article.image}" alt="${article.title}">` : '<div style="height:160px; background:#2a2a3a; border-radius:12px;"></div>'}
            <h3>${article.title}</h3>
            <p>${article.excerpt || article.content.substring(0,100)}...</p>
            <button onclick="viewArticle('${article.id}')">اقرأ المزيد</button>
        </div>
    `).join('');
}

// عرض مقال منفرد (يمكن عمل صفحة منفصلة أو modal)
window.viewArticle = async (id) => {
    const { data } = await supabase.from('articles').select('*').eq('id', id).single();
    if (data) alert(`فتح المقال: ${data.title}\n\n${data.content}`);
};

// نشر مقال جديد (لصفحة admin)
window.publishArticle = async () => {
    const title = document.getElementById('title')?.value;
    const category = document.getElementById('category')?.value;
    const excerpt = document.getElementById('excerpt')?.value;
    const content = document.getElementById('content')?.value;
    const fileInput = document.getElementById('imageFile');
    if (!title || !content) { alert('العنوان والمحتوى مطلوبان'); return; }
    
    let imageUrl = '';
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const fileName = `${Date.now()}_${file.name}`;
        const { data: upload, error: uploadErr } = await supabase.storage
            .from('magazine-images')
            .upload(fileName, file);
        if (uploadErr) { alert('فشل رفع الصورة'); return; }
        const { data: { publicUrl } } = supabase.storage.from('magazine-images').getPublicUrl(fileName);
        imageUrl = publicUrl;
    }
    
    const slug = title.replace(/[^\w\u0600-\u06FF]/g, '-').toLowerCase();
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from('articles').insert([{
        title, slug, content, excerpt, category, image: imageUrl,
        author_id: user.user.id, published: true
    }]);
    if (error) alert('خطأ: ' + error.message);
    else { alert('تم النشر بنجاح'); window.location.reload(); }
};

// ربط الأحداث عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    checkUser();
    // أزرار الأقسام
    const btns = document.querySelectorAll('.section-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', async () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const cat = btn.getAttribute('data-cat');
            await loadArticles(cat);
        });
    });
    // تحميل أولي
    loadArticles('home');
    // ربط زر النشر إذا كان موجوداً
    const pubBtn = document.getElementById('publishBtn');
    if (pubBtn) pubBtn.addEventListener('click', publishArticle);
});