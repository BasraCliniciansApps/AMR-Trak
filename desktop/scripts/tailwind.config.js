module.exports = {
  content: [__dirname + '/../app/index.html', __dirname + '/../app/js/**/*.js'],
  safelist: [
    'bg-emerald-100','text-emerald-800','text-emerald-600','bg-yellow-100','text-yellow-800','text-yellow-600',
    'bg-orange-200','text-orange-900','text-orange-500','bg-red-400','text-white','text-red-500',
    'bg-red-600','text-red-700','text-red-100','bg-white','text-slate-700','text-slate-500','opacity-70'
  ],
  theme: { extend: {} },
  plugins: []
};
