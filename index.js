const express = require('express');
const ejs = require('ejs');
const path = require('path');
const fs = require("fs");
const bodyParser = require('body-parser');
const session = require('express-session');
const MemoryStore = require("memorystore")(session);
const cors = require('cors');
const app = express();
const schedule = require('node-schedule');
var methodOverride = require('method-override');

// router
const userRouter = require("./router/users.js");
const postRouter = require("./router/posts.js");
const answerRouter = require("./router/answers.js");
const db = require('./models/db.js');
const { promises } = require('dns');

// 자동삭제 
const data = fs.readFileSync("parameters.json", 'utf8');
const parameters = JSON.parse(data);
const decayPeriod = parseInt(parameters.decayPeriod); // 감쇠주기(day)
const decayRate = parseFloat(parameters.decayRate);  // 감쇠율
const threshold = parseInt(parameters.threshold);   // 자동 삭제 임계치(중요도)

// ejs setting
app.set('views', __dirname + '/views');
app.set("view engine", "ejs");
app.engine('html', require('ejs').renderFile);

// session setting 
app.use(session({
    secret: process.env.SECRET,	// 암호화
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
        checkPeriod: 3600000, // 1 hour
    }),
    cookie: { maxAge: 3600000 },
    name: 'session-cookie'
}));

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// configuration 
require("dotenv").config();
app.set('port', process.env.PORT || 3000);
app.use(methodOverride('_method'));

// static file 
app.use('/uploads', express.static('uploads'));

// 라우터 등록
app.use('/users', userRouter);
app.use('/posts', postRouter);
app.use('/answers', answerRouter);

// 서버 동작 중 표시
app.listen(app.get('port'), () => {
    console.log('Express server listening on port ' + app.get('port'));
    console.log('http://localhost:' + app.get('port'));
});

// 메인 페이지
app.get('/', (req, res) => {
    if (req.session.user !== undefined) {
        console.log("login된 ", req.session.user.user_id);
        res.render("index", { user: req.session.user });
    } else {
        res.render("index", { user: "" });
    }
});



// 1시간 마다 체크
schedule.scheduleJob('0 1 * * *', async () => {
    try {
        await updateImportant();
        console.log('감쇄 체크');
    } catch (error) {
        console.error('감쇄 체크 문제 발생:', error);
    }
});

async function updateImportant() {

    let currentTime = new Date();
    let time, period, score;
    const importantRow = await queryDatabase('SELECT * FROM important', []);

    for (const row of importantRow) {
        time = Math.abs(currentTime - row.last_update);
        period = decayPeriod * (1000 * 60 * 60 * 24);
        console.log(row.last_update, time, period)

        if (time >= period) {
            score = row.score * decayRate;
            console.log(row.id, score)

            if (score < threshold) {
                // 삭제
                await queryDatabase('DELETE FROM important WHERE id = ?', [row.id]);
                console.log("삭제완료")
            } else {
                // 업데이트
                await queryDatabase('UPDATE important SET score = ?, last_update = CURRENT_TIMESTAMP WHERE id = ?', [score, row.id]);
                console.log("업데이트 완료")
            }
        }
    }
}

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