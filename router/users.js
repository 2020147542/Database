const express = require("express");
const router = express.Router();
const db = require('../models/db.js');

// 로그인 get
router.get('/login', function (req, res) {
    if (req.session.user) {
        return res.redirect("/");
    }
    return res.render("login", { message: "" });
})

// 로그인 post
router.post('/login', async (req, res) => {
    const email_id = req.body.id;
    const user_pw = req.body.pw;

    try {
        const sql = `SELECT * FROM users WHERE email_id=?`;
        const params = [email_id];
        const rows = await queryDatabase(sql, params);

        if (rows.length === 0) {
            return res.render("login", { message: "존재하지 않는 사용자 입니다." });

        } else if (user_pw === rows[0].password) {
            req.session.user = {
                user_id: rows[0].user_id,
                email_id: email_id,
                role: rows[0].type,
                name: rows[0].name

            };

            await saveSession(req);

            return res.write("<script> window.location.href = document.referrer; </script>");
        }
        return res.render("login", { message: "잘못된 비밀번호 입니다." });

    } catch (error) {
        console.error('Error:', error);
        return res.render("login", { message: error });
    }
});


// 로그아웃 요청 처리
router.get('/logout', async function (req, res) {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    req.session.destroy(function (err) {
        if (err) {
            return res.write(`<script> if(confirm("cannot access to session")) {
                window.location.href = "/"
                } </script>`);
        }

        return res.write(`<script> if(confirm("logout success")) {
                window.location.href = "/"
                } </script>`);
    });
});


async function queryDatabase(sql, params) {
    try {
        return await new Promise((resolve, reject) => {
            db.query(sql, params, (error, rows) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(rows);
                }
            });
        });
    } catch (error) {
        throw error;
    }
}

async function saveSession(req) {
    try {
        await new Promise((resolve, reject) => {
            req.session.save(err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    } catch (error) {
        throw error;
    }
}


module.exports = router;