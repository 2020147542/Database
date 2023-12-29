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
const clicksWeight = parseFloat(parameters.clicksWeight);  // 도움이 되어요 가중치


const upload = multer({
    storage: multer.diskStorage({

        destination: function (req, file, callback) {
            callback(null, 'uploads/answers/')
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


// 포스트내에서 정렬하기
router.post('/:postId/sorted', async (req, res) => {
    const post_id = req.params.postId;
    const sortBy = req.body.sortBy;

    if (!sortBy) {
        return res.write(`<script> if(confirm("정렬 기준을 선택하세요.")) {
                window.location.href = "/posts/${post_id}"
                } </script>`);
    }

    let sql = `SELECT a.*, i.score AS importance_score FROM answers a JOIN important i ON a.imp_id = i.id where post_id=?`;
    const params = [post_id];

    // 정렬 처리
    if (sortBy) {
        switch (sortBy) {
            case 'createdAt':
                sql += ' ORDER BY created_at DESC';
                break;
            case 'updatedAt':
                sql += ' ORDER BY updated_at DESC';
                break;
            case 'importance':
                sql += ' ORDER BY i.score DESC';
                break;
            default:
                return res.write(`<script> if(confirm("존재하지 않는 정렬 기준입니다.")) {
                    window.location.href = "/posts/${post_id}"
                    } </script>`);
        }
    }

    const answers = await queryDatabase(sql, params);

    const [postResult, mediaRows] = await Promise.all([
        queryDatabase("SELECT p.*, i.score AS importance_score FROM posts p JOIN important i ON p.imp_id = i.id where p.id=?", [parseInt(req.params.postId)]),
        queryDatabase("SELECT * FROM media WHERE post_id=?", [parseInt(req.params.postId)])
    ]);

    // 답변에 대한 첨부 파일 가져오기
    let mediaResult = {};
    const answerIds = answers.map(answer => answer.id);

    if (answerIds.length > 0) {
        for (const answerId of answerIds) {
            const query = "SELECT * FROM media WHERE answer_id=?";
            const result = await queryDatabase(query, [answerId]);
            if (result.length > 0) {
                mediaResult[answerId] = result;
            }
        }
    }

    let postGood = false;
    let answerGood = {};

    if (req.session.user) {
        postGood = await checkIfGood(req.session.user.user_id, parseInt(req.params.postId), null);
        if (answerIds.length > 0) {
            for (const answerId of answerIds) {
                answerGood[answerId] = await checkIfGood(req.session.user.user_id, null, answerId);
            }
        }
    }
    const formattedRows = formatRows(postResult);
    const formattedAnswers = formatRows(answers);

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

// 답글 추가 페이지
router.get('/:postId/add', async (req, res) => {

    const post_id = req.params.postId;

    // 로그인 여부 확인
    if (!req.session.user) {
        return res.redirect("/users/login");
    }

    return res.render("addAnswer", { postId: post_id });
});

// 답글 추가 요청
router.post('/:postId/add', upload.array("newFiles"), async (req, res) => {

    // 로그인 여부 확인 
    if (!req.session.user) {
        return res.write(`<script> if(confirm("세션이 만료되었습니다. 다시 로그인해주세요.")) {
                window.location.href = "/users/login"
                } </script>`);
    }

    // 중요도 저장
    const sql = "insert into important(score) values(?);";
    const rows = await queryDatabase(sql, [0]);

    // 답변 저장
    const sql2 = "INSERT INTO answers(user_id, post_id, title, contents, imp_id) VALUES (?, ?, ?, ?, ?)";
    const params = [req.session.user.user_id, parseInt(req.params.postId), req.body.title, req.body.content, rows.insertId];
    const row = await queryDatabase(sql2, params);

    // 첨부 파일 저장
    for (let i = 0; i < req.files.length; i++) {
        let extension = path.extname(req.files[i].originalname);
        const sql3 = "insert into media(name, type, post_id, answer_id) values(?, ?, ?, ?)";
        const paramss = [req.files[i].path, extension, null, row.insertId];
        await queryDatabase(sql3, paramss)
    }
    return res.redirect(`/posts/${parseInt(req.params.postId)}`);
});


// 답글 수정 페이지
router.get('/:answerId/edit', async (req, res) => {

    try {
        // 로그인 확인
        if (!req.session.user) {
            return res.redirect("/users/login");
        }

        const answerResult = await queryDatabase("SELECT * FROM answers WHERE id=?", [parseInt(req.params.answerId)]);

        // 수정 권한 체크
        if (!req.session.user.role) {
            if (req.session.user.user_id !== answerResult[0].user_id) {
                return res.write(`<script> if(confirm("not permitted")) {
                window.location.href = "/posts"
                } </script>`);
            }
        }

        const mediaRows = await queryDatabase("SELECT * FROM media WHERE answer_id=?", [parseInt(req.params.answerId)])

        // 화면 보이기
        return res.render("editAnswer", { edit: answerResult[0], files: mediaRows });
    } catch (error) {
        return res.write(`<script> if(confirm("this post is deleted")) {
                window.location.href = "/posts"
                } </script>`);
    }
});


// 수정 요청
router.put('/:answerId/edit', upload.array("newFiles"), async (req, res) => {

    const totalFile = req.body.totalFile;
    const totalFileArray = Array.isArray(totalFile) ? totalFile : [totalFile];
    const existedFile = req.body.filesToKeep;
    const existedFileArray = Array.isArray(existedFile) ? existedFile : [existedFile];
    const postId = req.body.postId;

    // 로그인 확인
    if (!req.session.user) {
        return res.write(`<script> if(confirm("세션이 만료되었습니다. 다시 로그인해주세요.")) {
                window.location.href = "/users/login"
                } </script>`);
    }

    // 기존 답글 수정
    const sql = `UPDATE answers SET title=?, contents=? WHERE id=?`;
    const params = [req.body.title, req.body.content, parseInt(req.params.answerId)];
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
            const paramss = [req.files[i].path, extension, null, parseInt(req.params.answerId)]
            const ro = await queryDatabase(sql3, paramss);
        }
    }

    // 화면에 보이기 
    return res.redirect(`/posts/${postId}`);
});


// 삭제 요청
router.get('/:answerId/delete', async (req, res) => {
    // 특정 답글 삭제
    try {
        const answerId = parseInt(req.params.answerId);
        if (!req.session.user) {
            return res.redirect("/users/login");
        }

        const sql = `SELECT imp_id FROM answers WHERE id=?`;
        const imp_id = await queryDatabase(sql, [answerId]);
        const sql2 = `DELETE FROM important WHERE id=?`;
        await queryDatabase(sql2, [imp_id[0].imp_id]);

        // 화면에 보이기
        return res.write(`<script> if(confirm("delete answer done.")) {
                window.location.href = "/posts"
                } </script>`);

    } catch (error) {
        return res.write(`<script> if(confirm("this post is already deleted")) {
                window.location.href = "/posts"
                } </script>`);
    }
});


router.post('/:answerId/like', async (req, res) => {
    // 특정 답글 도움이 되어요 표시 or 삭제

    if (!req.session.user) {
        return res.status(302).json({ redirect: "/users/login" });
    }

    const answerId = parseInt(req.params.answerId);
    const userId = req.session.user.user_id;
    const answer = await queryDatabase("SELECT imp_id FROM answers WHERE id=?", [answerId]);
    const important = await queryDatabase("SELECT * FROM important WHERE id=?", [answer[0].imp_id]);
    let score = 0;

    // 좋아요 상태 확인
    const isGood = await checkIfGood(userId, null, answerId);

    if (isGood) {
        await removeGood(userId, null, answerId);

        // 답변 중요도 감소
        score = important[0].score - clicksWeight;
        console.log(score)
        await queryDatabase("UPDATE important SET score=? WHERE id=?", [score, important[0].id]);
        res.json({ good: false });

    } else {
        await addGood(userId, null, answerId);

        // 답변 중요도 증가
        score = clicksWeight + important[0].score;
        console.log(score)
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