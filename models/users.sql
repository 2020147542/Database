-- --------------------------------------------------------
-- 호스트:                          127.0.0.1
-- 서버 버전:                        10.4.6-MariaDB - mariadb.org binary distribution
-- 서버 OS:                        Win64
-- HeidiSQL 버전:                  12.1.0.6537
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- database_project_202302 데이터베이스 구조 내보내기
CREATE DATABASE IF NOT EXISTS `database_project_202302` /*!40100 DEFAULT CHARACTER SET utf8 */;
USE `database_project_202302`;

-- 테이블 database_project_202302.users 구조 내보내기
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8;

-- 테이블 데이터 database_project_202302.users:~6 rows (대략적) 내보내기
INSERT INTO `users` (`user_id`, `email_id`, `password`, `name`, `type`, `birth`, `sex`, `address`, `phone`) VALUES
	(1, 'admin', 'admin', '관리자계정', 1, NULL, NULL, NULL, NULL),
	(2, 'user1', '1234', 'user계정1', 0, NULL, NULL, NULL, NULL),
	(3, 'user2', '1234', 'user계정2', 0, NULL, NULL, NULL, NULL),
	(4, 'user3', '1234', 'user계정3', 0, NULL, NULL, NULL, NULL),
	(5, 'user4', '1234', 'user계정4', 0, NULL, NULL, NULL, NULL),
	(6, 'user5', '1234', 'user계정5', 0, NULL, NULL, NULL, NULL);

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
