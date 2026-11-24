/*
 * Mini-API « BeautyShop » pour l'application Ionic.
 * Aucune dépendance : lancer avec npm start (ou node server.js).
 * Écoute sur http://localhost:3000/api
 *
 * Les données vivent en mémoire : un redémarrage remet le panier et les
 * commandes à zéro. Les images des produits sont des URL Unsplash.
 */
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const LATENCE_MS = Number(process.env.LATENCE_MS || 0);
const DOSSIER_IMAGES = path.join(__dirname, 'images');

/* ------------------------------------------------------------------ */
/*  Données                                                            */
/* ------------------------------------------------------------------ */
const categories = [
  { id: 'CAT001', nom: 'Soin du visage' },
  { id: 'CAT002', nom: 'Maquillage' },
  { id: 'CAT003', nom: 'Parfum' },
  { id: 'CAT004', nom: 'Cheveux' },
  { id: 'CAT005', nom: 'Corps' },
];

let produits = [
  { id: 'PROD001', nom: 'Crème Visage Nude', description: 'Hydratation douce au beurre de karité pour un éclat naturel.', prix: '28.00', ancien_prix: null, categorie_id: 'CAT001', image: '/images/creme-visage.jpg', images: ['/images/creme-visage.jpg', '/images/creme-visage-2.jpg'], note: 4.8, nombre_avis: 124, disponible: true, nouveaute: true, style_nude: true },
  { id: 'PROD002', nom: 'Sérum Éclat Rose', description: 'Sérum illuminateur à l’extrait de rose pour un teint lumineux.', prix: '42.00', ancien_prix: '49.00', categorie_id: 'CAT001', image: '/images/serum-eclat.jpg', note: 4.9, nombre_avis: 89, disponible: true, style_nude: true },
  { id: 'PROD003', nom: 'Rouge à Lèvres Nude', description: 'Finition mate veloutée, teinte nude beige, longue tenue.', prix: '22.00', categorie_id: 'CAT002', image: '/images/rouge-a-levres.jpg', note: 4.7, nombre_avis: 210, disponible: true, style_nude: true },
  { id: 'PROD004', nom: 'Palette Ombre Terre', description: '9 teintes nudes et terrestres pour un regard profond.', prix: '35.00', categorie_id: 'CAT002', image: '/images/palette-maquillage.jpg', note: 4.6, nombre_avis: 67, disponible: true, style_nude: true },
  { id: 'PROD005', nom: 'Huile Capillaire Dorée', description: 'Nutrition intense aux huiles d’argan et de jojoba.', prix: '31.00', categorie_id: 'CAT004', image: '/images/huile-capillaire.jpg', note: 4.8, nombre_avis: 156, disponible: true, style_nude: false },
  { id: 'PROD006', nom: 'Gel Douche Nuage', description: 'Nettoyage doux au parfum de fleur d’oranger.', prix: '18.00', categorie_id: 'CAT005', image: '/images/gel-douche.jpg', note: 4.5, nombre_avis: 93, disponible: true, style_nude: true },
  { id: 'PROD007', nom: 'Eau de Parfum Nude', description: 'Fragrance boisée et poudrée, signature minimaliste.', prix: '65.00', categorie_id: 'CAT003', image: '/images/parfum-nude.jpg', note: 4.9, nombre_avis: 74, disponible: true, style_nude: true },
  { id: 'PROD008', nom: 'Masque Visage Argile', description: 'Purifie et apaise les peaux sensibles.', prix: '24.00', categorie_id: 'CAT001', image: '/images/masque-visage.jpg', note: 4.7, nombre_avis: 112, disponible: true, nouveaute: true },
  { id: 'PROD009', nom: 'Poudre Libre Nude', description: 'Finition mate et légère pour un teint unifié.', prix: '29.00', categorie_id: 'CAT002', image: '/images/poudre-libre.jpg', note: 4.6, nombre_avis: 58, disponible: true, style_nude: true },
  { id: 'PROD010', nom: 'Lait Corps Douceur', description: 'Hydratation 24h au lait d’amande douce.', prix: '26.00', categorie_id: 'CAT005', image: '/images/lait-corps.jpg', note: 4.7, nombre_avis: 143, disponible: true, style_nude: true },
  { id: 'PROD011', nom: 'Shampoing Doux', description: 'Nettoyage respectueux du cuir chevelu sensible.', prix: '20.00', categorie_id: 'CAT004', image: '/images/shampoing.jpg', note: 4.5, nombre_avis: 88, disponible: true },
  { id: 'PROD012', nom: 'Vernis à Ongles Nude', description: 'Teinte rose pailletée, tenue 7 jours.', prix: '15.00', categorie_id: 'CAT002', image: '/images/vernis-nude.jpg', note: 4.6, nombre_avis: 132, disponible: true, style_nude: true },
];

let panier = [];
let commandes = [];
let prochainIdCommande = 1;

/* ------------------------------------------------------------------ */
/*  Outils                                                             */
/* ------------------------------------------------------------------ */
const montant = (n) => Number(n).toFixed(2);

function avecCategorie(produit) {
  const categorie = categories.find((c) => c.id === produit.categorie_id) || null;
  return { ...produit, categorie };
}

function envoyer(res, statut, donnees) {
  const corps = donnees === undefined ? '' : JSON.stringify(donnees);
  setTimeout(() => {
    res.writeHead(statut, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(corps);
  }, LATENCE_MS);
}

function lireCorps(req) {
  return new Promise((resolve) => {
    let brut = '';
    req.on('data', (morceau) => { brut += morceau; });
    req.on('end', () => {
      if (!brut) return resolve({});
      try { resolve(JSON.parse(brut)); } catch { resolve(null); }
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Routes                                                             */
/* ------------------------------------------------------------------ */
async function router(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const chemin = url.pathname.replace(/\/+$/, '');
  const methode = req.method;
  let resultat;

  if (methode === 'OPTIONS') return envoyer(res, 204);
  if (methode === 'GET' && (resultat = chemin.match(/^\/images\/([\w.-]+)$/))) {
    const fichier = path.join(DOSSIER_IMAGES, resultat[1]);
    if (!fs.existsSync(fichier) || !fs.statSync(fichier).isFile()) {
      return envoyer(res, 404, { message: 'Image introuvable.' });
    }
    const types = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
    res.writeHead(200, { 'Content-Type': types[path.extname(fichier).toLowerCase()] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
    return fs.createReadStream(fichier).pipe(res);
  }
  if (methode === 'GET' && chemin === '/api/health') return envoyer(res, 200, { statut: 'ok' });
  if (methode === 'GET' && chemin === '/api/categories') return envoyer(res, 200, categories);

  // GET /api/produits?categorie=CAT001
  if (methode === 'GET' && chemin === '/api/produits') {
    const categorieId = url.searchParams.get('categorie');
    const liste = categorieId ? produits.filter((p) => p.categorie_id === categorieId) : produits;
    return envoyer(res, 200, liste.map(avecCategorie));
  }

  // GET /api/produits/:id
  if (methode === 'GET' && (resultat = chemin.match(/^\/api\/produits\/([^/]+)$/))) {
    const produit = produits.find((p) => p.id === resultat[1]);
    return produit ? envoyer(res, 200, avecCategorie(produit)) : envoyer(res, 404, { message: 'Produit introuvable.' });
  }

  // GET|POST|DELETE /api/panier
  if (methode === 'GET' && chemin === '/api/panier') return envoyer(res, 200, panier);
  if (methode === 'POST' && chemin === '/api/panier') {
    const corps = await lireCorps(req);
    if (corps === null) return envoyer(res, 400, { message: 'JSON invalide.' });
    const produit = produits.find((p) => p.id === corps.produit_id);
    const quantite = Number(corps.quantite ?? 1);
    if (!produit) return envoyer(res, 404, { message: 'Produit introuvable.' });
    if (!Number.isInteger(quantite) || quantite < 1) return envoyer(res, 422, { message: 'La quantité doit être un entier positif.' });
    const article = panier.find((a) => a.produit_id === produit.id);
    if (article) article.quantite += quantite;
    else panier.push({ produit_id: produit.id, produit: avecCategorie(produit), quantite });
    return envoyer(res, 201, panier);
  }
  if (methode === 'DELETE' && chemin === '/api/panier') {
    panier = [];
    return envoyer(res, 200, panier);
  }
  if (methode === 'DELETE' && (resultat = chemin.match(/^\/api\/panier\/([^/]+)$/))) {
    panier = panier.filter((article) => article.produit_id !== resultat[1]);
    return envoyer(res, 200, panier);
  }

  // GET /api/commandes et GET /api/commandes/:id
  if (methode === 'GET' && chemin === '/api/commandes') return envoyer(res, 200, [...commandes].reverse());
  if (methode === 'GET' && (resultat = chemin.match(/^\/api\/commandes\/(\d+)$/))) {
    const commande = commandes.find((c) => c.id === Number(resultat[1]));
    return commande ? envoyer(res, 200, commande) : envoyer(res, 404, { message: 'Commande introuvable.' });
  }

  // POST /api/commandes : crée une commande à partir du panier actuel
  if (methode === 'POST' && chemin === '/api/commandes') {
    if (panier.length === 0) return envoyer(res, 400, { message: 'Le panier est vide.' });
    const lignes = panier.map((article) => ({
      produit_id: article.produit_id,
      nom: article.produit.nom,
      quantite: article.quantite,
      prix_unitaire: article.produit.prix,
      sous_total: montant(Number(article.produit.prix) * article.quantite),
    }));
    const commande = {
      id: prochainIdCommande++,
      date: new Date().toISOString(),
      statut: 'en_preparation',
      montant_total: montant(lignes.reduce((total, ligne) => total + Number(ligne.sous_total), 0)),
      lignes,
    };
    commandes.push(commande);
    panier = [];
    return envoyer(res, 201, commande);
  }

  return envoyer(res, 404, { message: `Route inconnue : ${methode} ${chemin}` });
}

http.createServer((req, res) => {
  router(req, res).catch((erreur) => {
    console.error(erreur);
    envoyer(res, 500, { message: 'Erreur interne.' });
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`API BeautyShop prête sur http://localhost:${PORT}/api`);
  console.log(`Images locales servies depuis http://localhost:${PORT}/images/`);
  console.log('Routes : GET /api/categories, GET /api/produits, GET /api/produits/:id');
  console.log('         GET|POST|DELETE /api/panier, GET|POST /api/commandes');
});
