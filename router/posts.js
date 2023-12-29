const express = require("express");
const router = express.Router();
const db = require('../models/db.js');
const multer = require("multer");
const path = require('path');
const fs = require("fs");

// upload 파일 연동 or 생성
try {
    fs.accessSync("uploads");
} catch (error) {
    fs.mkdirSync("uploads");
}

const data = fs.readFileSync("parameters.json", 'utf8');
const parameters = JSON.parse(data);
const viewsWeight = parseFloat(parameters.viewsWeight);  // 조회수 가중치
const clicksWeight = parseFloat(parameters.clicksWeight);  // 도움이 되어요 가중치


const upload = multer({
    storage: multer.diskStorage({

        destination: function (req, file, callback) {
            callback(null, 'uploads/posts/')
        },
        filename: function (req, file, callback) {

            let extension = path.extname(file.originalname);
            let basename = path.basename(file.originalname, extension);
            let filename = basename + Date.now() + extension;

            callback(null, filename);
        }
    }),
    limits: { fileSize: 20 * 1024 * 1024 }
});


// 질문 글 전체 보기
router.get('/', async (req, res) => {

    // 전체 게시글 리스트 보기
    const sql = "SELECT p.*, i.score AS importance_score FROM posts p JOIN important i ON p.imp_id = i.id;";
    const rows = await queryDatabase(sql, []);

    const formattedRows = formatRows(rows);
    if (formattedRows.length === 0) {
        return res.render("posts", { posts: "" });
    }

    return res.render("posts", { posts: formattedRows });
});


// 정렬, 검색 요청
router.post('/', async (req, res) => {
    const category = req.body.category;
    const keyword = req.body.keyword;
    const sortBy = req.body.sortBy;

    if (!(category && keyword) && !sortBy) {
        return res.write(`<script> if(confirm("something is missing")) {
                window.location.href = "/posts"
                } </script>`);
    }

    let sql = 'SELECT p.*, i.score AS importance_score FROM posts p JOIN important i ON p.imp_id = i.id';
    const params = [];

    // 검색어 처리
    if (category && keyword) {
        switch (category) {
            case 'title':
                sql += ' WHERE title LIKE ?';
                params.push(`%${keyword}%`);
                break;
            case 'content':
                sql += ' WHERE contents LIKE ?';
                params.push(`%${keyword}%`);
                break;
            case 'titleAndContent':
                sql += ' WHERE title LIKE ? OR contents LIKE ?';
                params.push(`%${keyword}%`, `%${keyword}%`);
                break;
            default:
                return res.write(`<script> if(confirm("존재하지 않는 카테고리입니다.")) {
                    window.location.href = "/posts"
                    } </script>`);
        }
    }

    // 정렬 처리
    if (sortBy) {
        switch (sortBy) {
            case 'createdAt':
                sql += ' ORDER BY created_at DESC';
                break;
            case 'updatedAt':
                sql += ' ORDER BY updated_at DESC';
                break;
            case 'views':
                sql += ' ORDER BY views DESC';
                break;
            case 'importance':
                sql += ' ORDER BY i.score DESC';
                break;
            default:
                return res.write(`<script> if(confirm("존재하지 않는 정렬 기준입니다.")) {
                    window.location.href = "/posts"
                    } </script>`);
        }
    }


    const rows = await queryDatabase(sql, params);
    const formattedRows = formatRows(rows);
    if (formattedRows.length > 0) {
        return res.render("posts", { posts: formattedRows });
    }

    return res.render("posts", { posts: "" });
});


// 포스트 추가 페이지
router.get('/add', async (req, res) => {

    // 로그인 여부 확인
    if (!req.session.user) {
        return res.redirect("/users/login");
    }

    return res.render("addPost", {});
});


// 포스트 추가 요청
router.post('/add', upload.array("newFiles"), async (req, res) => {

    // 로그인 여부 확인 
    if (!req.session.user) {
        return res.write(`<script> if(confirm("session expired.")) {
                window.location.href = "/users/login"
                } </script>`);
    }

    // 중요도 저장
    const impResult = await queryDatabase("insert into important(score) values(?);", [0]);
    const impId = impResult.insertId;

    // 게시글 저장
    const postResult = await queryDatabase("INSERT INTO posts(user_id, title, contents, views, imp_id) VALUES (?, ?, ?, ?, ?)",
        [req.session.user.user_id, req.body.title, req.body.content, 0, impId]);
    const postId = postResult.insertId;

    // 첨부 파일 저장
    for (let i = 0; i < req.files.length; i++) {
        let extension = path.extname(req.files[i].originalname);
        const sql3 = "insert into media(name, type, post_id, answer_id) values(?, ?, ?, ?)";
        const paramss = [req.files[i].path, extension, postId, null];
        await queryDatabase(sql3, paramss)
    }
    return res.redirect("/posts");
});


// 포스트 + 답글 자세히 보기
router.get('/:postId', async (req, res) => {

    const postResult = await queryDatabase("SELECT views, imp_id FROM posts WHERE id=?", [parseInt(req.params.postId)]);

    // 존재하지 않는 게시물일 경우
    if (postResult.length === 0) {
        return res.write(`<script> if(confirm("존재하지 않는 게시물입니다.")) {
                window.location.href = "/posts"
                } </script>`);
    }
    // 질문 조회수 증가 
    await queryDatabase("UPDATE posts SET views=? WHERE id=?", [postResult[0].views + 1, parseInt(req.params.postId)]);

    // 질문 중요도 증가
    const important = await queryDatabase("SELECT * FROM important WHERE id=?", [postResult[0].imp_id]);
    let score = viewsWeight + important[0].score;
    await queryDatabase("UPDATE important SET score=? WHERE id=?", [score, important[0].id]);

    // 답변 가져오기
    const answers = await queryDatabase("SELECT * FROM answers WHERE post_id=?", [parseInt(req.params.postId)]);

    let mediaResult = {};
    let answerIds = answers.map(answer => answer.id)

    if (answers && answers.length > 0) {
        for (const answer of answers) {

            // 답변에 대한 첨부 파일 가져오기
            const query = "SELECT * FROM media WHERE answer_id=?";
            const result = await queryDatabase(query, [answer.id]);
            if (result.length > 0) {
                mediaResult[answer.id] = result;
            }
            // 답변 조회수 올리기
            await queryDatabase("UPDATE answers SET views=? WHERE id=?", [answer.views + 1, answer.id]);

            // 답변 중요도 증가
            const important1 = await queryDatabase("SELECT * FROM important WHERE id=?", [answer.imp_id]);
            let score1 = viewsWeight + important1[0].score;
            await queryDatabase("UPDATE important SET score=? WHERE id=?", [score1, important1[0].id]);
        }
    }

    let postGood = false;
    let answerGood = {};

    if (req.session.user) {
        postGood = await checkIfGood(req.session.user.user_id, parseInt(req.params.postId), null);
        if (answerIds && answerIds.length > 0) {
            for (const answerId of answerIds) {
                answerGood[answerId] = await checkIfGood(req.session.user.user_id, null, answerId);
            }
        }
    }

    // 최종 답변
    const [postResults, mediaRows, answerss] = await Promise.all([
        queryDatabase("SELECT p.*, i.score AS importance_score FROM posts p JOIN important i ON p.imp_id = i.id where p.id=?", [parseInt(req.params.postId)]),
        queryDatabase("SELECT * FROM media WHERE post_id=?", [parseInt(req.params.postId)]),
        queryDatabase("SELECT a.*, i.score AS importance_score FROM answers a JOIN important i ON a.imp_id = i.id where a.post_id=?", [parseInt(req.params.postId)])
    ]);

    const formattedRows = formatRows(postResults);
    const formattedAnswers = formatRows(answerss);

    return res.render("postDetail", {
        postDetail: formattedRows,
        postFile: mediaRows,
        isPostGood: postGood,
        answers: formattedAnswers,
        answersFile: mediaResult,
        isAnswerGood: answerGood,
        users: req.session.user
    });
});


// 질문 수정 페이지
router.get('/:postId/edit', async (req, res) => {

    try {
        // 로그인 확인
        if (!req.session.user) {
            return res.redirect("/users/login");
        }

        const postResult = await queryDatabase("SELECT * FROM posts WHERE id=?", [parseInt(req.params.postId)])


        // 수정 권한 체크
        if (!req.session.user.role) {
            if (req.session.user.user_id !== postResult[0].user_id) {
                return res.write(`<script> if(confirm("not permitted")) {
                window.location.href = "/posts"
                } </script>`);
            }
        }

        const mediaRows = await queryDatabase("SELECT * FROM media WHERE post_id=?", [parseInt(req.params.postId)]);

        // 화면 보이기
        return res.render("editPost", { edit: postResult[0], files: mediaRows });

    } catch (error) {
        return res.write(`<script> if(confirm("this post is deleted")) {
                window.location.href = "/posts"
                } </script>`);
    }
});


router.put('/:postId/edit', upload.array("newFiles"), async (req, res) => {

    const totalFile = req.body.totalFile;
    const totalFileArray = Array.isArray(totalFile) ? totalFile : [totalFile];
    const existedFile = req.body.filesToKeep;
    const existedFileArray = Array.isArray(existedFile) ? existedFile : [existedFile];

    // 로그인 확인
    if (!req.session.user) {
        return res.write(`<script> if(confirm("session expired.")) {
                window.location.href = "/users/login"
                } </script>`);
    }

    // 기존 글 수정
    const sql = `UPDATE posts SET title=?, contents=?, updated_at = CURRENT_TIMESTAMP WHERE id=?`;
    const params = [req.body.title, req.body.content, parseInt(req.params.postId)];
    await queryDatabase(sql, params);

    // existedFile에 없는 파일 ID 찾기
    if (totalFileArray) {
        const filesToDelete = totalFileArray.filter(fileId => !existedFileArray.includes(fileId));

        // filesToDelete에 있는 파일들을 삭제
        filesToDelete.forEach(async fileId => {
            const sql3 = `DELETE FROM media WHERE id=?`;
            const paramss = [fileId];
            await queryDatabase(sql3, paramss);
        });
    }

    // 첨부 파일이 있다면
    if (req.files) {

        // 첨부 파일 저장
        for (let i = 0; i < req.files.length; i++) {
            let extension = path.extname(req.files[i].originalname);
            const sql3 = `insert into media(name, type, post_id, answer_id) values(?, ?, ?, ?)`;
            const paramss = [req.files[i].path, extension, parseInt(req.params.postId), null]
            const ro = await queryDatabase(sql3, paramss);
        }
    }

    // 화면에 보이기 
    return res.redirect(`/posts/${parseInt(req.params.postId)}`);
});


router.get('/:postId/delete', async (req, res) => {
    // 게시글 삭제
    try {
        if (!req.session.user) {
            return res.redirect("/users/login");
        }

        const sql = `SELECT imp_id FROM posts WHERE id=?`;
        const imp_id = await queryDatabase(sql, [parseInt(req.params.postId)]);
        const sql2 = `DELETE FROM important WHERE id=?`;
        await queryDatabase(sql2, [imp_id[0].imp_id]);

        // 화면에 보이기
        return res.write(`<script> if(confirm("delete post done.")) {
                window.location.href = "/posts"
                } </script>`);

    } catch (error) {
        return res.write(`<script> if(confirm("this post is already deleted")) {
                window.location.href = "/posts"
                } </script>`);
    }
});


router.post('/:postId/like', async (req, res) => {
    // 특정 글 도움이 되어요 표시 or 삭제
    if (!req.session.user) {
        return res.status(302).json();
    }

    const postId = parseInt(req.params.postId);
    const userId = req.session.user.user_id;
    const post = await queryDatabase("SELECT imp_id FROM posts WHERE id=?", [postId]);
    const important = await queryDatabase("SELECT * FROM important WHERE id=?", [post[0].imp_id]);
    let score = 0;

    // 좋아요 상태 확인
    const isGood = await checkIfGood(userId, postId, null);

    if (isGood) {
        await removeGood(userId, postId, null);

        // 질문 중요도 감소
        score = important[0].score - clicksWeight;
        await queryDatabase("UPDATE important SET score=? WHERE id=?", [score, important[0].id]);
        res.json({ good: false });

    } else {
        await addGood(userId, postId, null);

        // 질문 중요도 증가
        score = clicksWeight + important[0].score;
        await queryDatabase("UPDATE important SET score=? WHERE id=?", [score, important[0].id]);
        res.json({ good: true });
    }
});

// 도움돼요 상태 확인 함수
async function checkIfGood(userId, postId, answerId) {
    let sql = 'SELECT * FROM likes';
    let params = [];
    if (userId && postId) {
        sql += ' WHERE user_id=? AND post_id=?';
        params = [userId, postId];

    } else if (userId && answerId) {
        sql += ' WHERE user_id=? AND answer_id=?';
        params = [userId, answerId];
    }

    const rows = await queryDatabase(sql, params);
    return rows.length > 0;
}

// 도움돼요 추가 함수
async function addGood(userId, postId, answerId) {
    let sql = 'INSERT INTO likes(user_id, post_id, answer_id) VALUES(?, ?, ?)';
    let params = [];

    if (userId && postId) {
        params = [userId, postId, null];

    } else if (userId && answerId) {
        params = [userId, null, answerId];
    }

    await queryDatabase(sql, params);
}

// 도움돼요 취소 함수
async function removeGood(userId, postId, answerId) {
    let sql = 'DELETE FROM likes';
    let params = [];

    if (userId && postId) {
        sql += ' WHERE user_id=? AND post_id=?';
        params = [userId, postId];

    } else if (userId && answerId) {
        sql += ' WHERE user_id=? AND answer_id=?';
        params = [userId, answerId];
    }

    await queryDatabase(sql, params);
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

function formatRows(rowsArray) {
    if (!rowsArray || !Array.isArray(rowsArray) || rowsArray.length === 0) {
        return [];
    }

    const formattedRows = rowsArray.map(post => {
        return {
            id: post.id,
            userId: post.user_id,
            title: post.title,
            created_at: formatDateTime(post.created_at),
            views: post.views,
            updated_at: formatDateTime(post.updated_at),
            content: post.contents,
            important: post.importance_score
        };
    });

    return formattedRows;
}

const formatDateTime = (dateTimeString) => {
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
    };

    const dateTime = new Date(dateTimeString);
    return dateTime.toLocaleString('ko-KR', options);
};

module.exports = router;