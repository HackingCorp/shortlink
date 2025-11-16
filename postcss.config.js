export default {
  plugins: {
    'postcss-nesting': {}, // C'est le nom correct qui correspond au paquet installé
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production' ? { cssnano: {} } : {})
  },
};