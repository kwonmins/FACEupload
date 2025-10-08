const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const multer = require("multer");
const fs = require("fs");
const FormData = require("form-data");
const axios = require("axios");

const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users"); // 파일명이 user.js인 경우

const app = express();
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "/tmp"), // ✅ 유일한 쓰기 가능 경로
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + (file.originalname || "file")),
});
const upload = multer({ storage });

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);

// ✅ 업로드 및 Colab 호출 라우트
app.post(
  "/upload",
  upload.fields([{ name: "user" }, { name: "style" }, { name: "color" }]),
  async (req, res) => {
    try {
      const userPath = req.files["user"]?.[0]?.path;
      const stylePath = req.files["style"]?.[0]?.path;
      const colorPath = req.files["color"]?.[0]?.path;

      if (!userPath || !stylePath || !colorPath) {
        throw new Error("❌ 모든 파일이 업로드되지 않았습니다.");
      }

      const form = new FormData();
      form.append("user", fs.createReadStream(userPath));
      form.append("style", fs.createReadStream(stylePath));
      form.append("color", fs.createReadStream(colorPath));

      const response = await axios.post(
        "https://acca9c26ef41.ngrok-free.app/generate", // 🔁  ngrok 주소
        form,
        {
          headers: form.getHeaders(),
          responseType: "arraybuffer",
        }
      );

      const base64Image = Buffer.from(response.data).toString("base64");
      const base64User = fs.readFileSync(userPath, "base64");
      const base64Style = fs.readFileSync(stylePath, "base64");
      const base64Color = fs.readFileSync(colorPath, "base64");

      res.render("result", {
        base64User,
        base64Style,
        base64Color,
        base64Image,
      });
    } catch (err) {
      console.error("❌ Colab 서버 호출 실패:", err.message);
      res.status(500).send("서버 오류");
    }
  }
);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

const port = 3000;
app.listen(port, () => {
  console.log(`✅ Express 서버 실행 중: http://localhost:${port}`);
});

module.exports = app;
