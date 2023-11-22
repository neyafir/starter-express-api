const express = require('express');
const bodyParser = require('body-parser');
const Jimp = require('jimp');

const app = express();
const port = 3000;

const image_x = 200;
const image_y = 150;

// Stocker les comptes à rebours par adresse IP
let cooldowns = {};

// Créer une image de image_x x image_y avec un fond blanc
// let image = new Jimp(image_x, image_y, '#EEEEEE');


// Charger l'image de base
let image;
Jimp.read('base.png')
    .then(loadedImage => {
        image = loadedImage;
        // Démarrer le serveur une fois l'image chargée
        app.listen(port, () => {
            console.log(`Serveur démarré sur http://localhost:${port}`);
        });
    })
    .catch(err => {
        console.error('Erreur lors du chargement de l\'image de base:', err);
    });


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Servir la page HTML
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Endpoint pour mettre à jour un pixel
app.post('/update-pixel', (req, res) => {
    let { x, y, color, type } = req.body;

    // Convertir x et y en entiers
    x = parseInt(x);
    y = parseInt(y);

    // Vérifier que x et y sont des nombres
    if (isNaN(x) || isNaN(y)) {
        return res.status(400).send('Les coordonnées x et y doivent être des nombres.');
    }

    // Vérifier que x et y sont dans les limites de l'image
    if (x < 0 || y < 0 || x >= image_x || y >= image_y) {
        return res.status(400).send('Coordonnées invalides.');
    }

    const ip = req.ip;
    const currentTime = new Date().getTime();

    // Vérifier s'il y a un compte à rebours pour cette IP
    if (cooldowns[ip] && cooldowns[ip] > currentTime) {
        return res.status(429).send(`Vous devez attendre ${Math.round((cooldowns[ip] - currentTime) / 1000)} secondes.`);
    }

    try {
        const colorHex = Jimp.cssColorToHex(color);
        let cooldownTime = 30;

        if (type === 0) {
            image.setPixelColor(colorHex, x, y);
        } else if (type === 1) {
            // Mettre à jour toute la rangée Y
            for (let i = 0; i < image.bitmap.width; i++) {
                image.setPixelColor(colorHex, i, y);
                cooldownTime = 120;
            }
        } else if (type === 2) {
            // Mettre à jour toute la colonne X
            for (let i = 0; i < image.bitmap.height; i++) {
                image.setPixelColor(colorHex, x, i);
                cooldownTime = 120;
            }
        } else if (type === 3) {
            // Mettre à jour des pixels aléatoires
            const numberOfPixels = 100; // Nombre de pixels à changer
            for (let i = 0; i < numberOfPixels; i++) {
                let randomX = Math.floor(Math.random() * image.bitmap.width);
                let randomY = Math.floor(Math.random() * image.bitmap.height);
                image.setPixelColor(colorHex, randomX, randomY);
                cooldownTime = 60;
            }
        } else {
            throw Error("type not know")
        }

        cooldowns[ip] = currentTime + cooldownTime * 1000;

        image.write('image.png', () => {
            console.log(`Pixel mis à jour en (${x}, ${y}) avec la couleur ${color} - action type ${type}`);
            res.send("Pixel mis à jour.");
        });
    } catch (error) {
        res.status(500).send('Erreur lors de la mise à jour du pixel: ' + error.message);
    }
});


// Endpoint pour obtenir l'image
app.get('/image', (req, res) => {
    image.getBuffer(Jimp.MIME_PNG, (err, buffer) => {
        if (err) {
            res.status(500).send('Erreur lors de la récupération de l\'image.');
        } else {
            res.set('Content-Type', 'image/png');
            res.send(buffer);
        }
    });
});

app.get('/cooldown', (req, res) => {
    const ip = req.ip;
    const currentTime = new Date().getTime();

    if (cooldowns[ip] && cooldowns[ip] > currentTime) {
        // Renvoyer le temps restant en secondes
        res.json({ cooldown: Math.round((cooldowns[ip] - currentTime) / 1000) });
    } else {
        // Pas de compte à rebours en cours
        res.json({ cooldown: 0 });
    }
});

// Endpoint pour réinitialiser le compte à rebours
app.get('/reset-cooldown', (req, res) => {
    const ip = req.ip;

    // Réinitialiser le compte à rebours pour cette IP
    if (cooldowns[ip]) {
        cooldowns[ip] = 0;
        res.send("Compte à rebours réinitialisé.");
    } else {
        res.send("Pas de compte à rebours actif à réinitialiser.");
    }
});

// app.listen(port, () => {
//     console.log(`Serveur démarré sur http://localhost:${port}`);
// });
