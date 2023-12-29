-- database_project_202302 데이터베이스 구조 생성
CREATE DATABASE IF NOT EXISTS `database_project_202302` /*!40100 DEFAULT CHARACTER SET utf8 */;
USE `database_project_202302`;


-- 테이블 database_project_202302.users 구조 생성
CREATE TABLE IF NOT EXISTS `users` (
    `user_id` int(11) NOT NULL AUTO_INCREMENT,
    `email_id` varchar(255) NOT NULL,
    `password` varchar(255) NOT NULL,
    `name` varchar(1000) NOT NULL,
    `type` int(11) DEFAULT 0,
    `birth` datetime DEFAULT NULL,
    `sex` int(11) DEFAULT NULL,
    `address` text DEFAULT NULL,
    `phone` varchar(255) DEFAULT NULL,
    PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- 테이블 database_project_202302.important 구조 생성
CREATE TABLE IF NOT EXISTS `important` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `score` float NOT NULL,
    `last_update` datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
)ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- 테이블 database_project_202302.posts 구조 생성
CREATE TABLE IF NOT EXISTS `posts` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `user_id` int(11),
    `title` varchar(255) NOT NULL,
    `contents` text,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `views` int(11) DEFAULT 0,
    `imp_id` int(11),
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES users(`user_id`),
    FOREIGN KEY (`imp_id`) REFERENCES important(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8; 

-- 테이블 database_project_202302.likes 구조 생성
CREATE TABLE IF NOT EXISTS `likes` (
	`id` int(11) NOT NULL AUTO_INCREMENT,
    `user_id` int(11),
    `post_id` int(11) DEFAULT null,
    `answer_id` int(11) DEFAULT null,
    PRIMARY KEY (`id` ),
    FOREIGN KEY (`user_id`) REFERENCES users(`user_id`) ON DELETE CASCADE,
    FOREIGN KEY (`post_id`) REFERENCES posts(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`answer_id`) REFERENCES answers(`id`) ON DELETE CASCADE
)ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- 테이블 database_project_202302.media 구조 생성
CREATE TABLE IF NOT EXISTS `media` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `name` varchar(255) NOT NULL,
    `type` varchar(255) NOT NULL,
    `post_id` int(11),
    `answer_id` int(11),
    PRIMARY KEY (`id`),
    FOREIGN KEY (`post_id`) REFERENCES posts(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`answer_id`) REFERENCES answers(`id`) ON DELETE CASCADE
)ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- 테이블 database_project_202302.answers 구조 생성
CREATE TABLE IF NOT EXISTS `answers` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `user_id` int(11),
    `post_id` int(11),
    `title` varchar(255) NOT NULL,
    `contents` varchar(2000),
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
    `views` int(11) DEFAULT 0,
    `imp_id` int(11),
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES users(`user_id`),
    FOREIGN KEY (`post_id`) REFERENCES posts(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`imp_id`) REFERENCES important(`id`) ON DELETE CASCADE
)ENGINE=InnoDB DEFAULT CHARSET=utf8;
