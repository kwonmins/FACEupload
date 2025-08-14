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
const usersRouter = require("./routes/users");

const app = express();

// ✅ Vercel 서버리스: /tmp만 사용 가능
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "/tmp"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + (file.originalname || "file")),
});
const upload = multer({ storage });

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: false, limit: "20mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);

// (옵션) 콜랩 핑
app.get("/ping-colab", async (req, res) => {
  try {
    const r = await axios.get("https://500c6f6d7fd0.ngrok-free.app/healthz", {
      timeout: 5000,
    });
    res.send(`ok ${r.status} ${r.data}`);
  } catch (e) {
    const body = e.response?.data
      ? Buffer.isBuffer(e.response.data)
        ? e.response.data.toString()
        : JSON.stringify(e.response.data)
      : e.message;
    res.status(502).send(`fail ${e.response?.status} ${body}`);
  }
});

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
        "https://500c6f6d7fd0.ngrok-free.app/generate",
        form,
        {
          headers: form.getHeaders(),
          responseType: "arraybuffer",
          timeout: 55000, // ⬅️ Vercel 함수 제한(60s) 대비
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
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
      const status = err.response?.status;
      const body = err.response?.data
        ? Buffer.isBuffer(err.response.data)
          ? err.response.data.toString()
          : JSON.stringify(err.response.data)
        : err.message;

      console.error("❌ Colab 서버 호출 실패:", status, body);
      res.status(500).send("서버 오류");
    }
  }
);

// 404
app.use(function (req, res, next) {
  next(createError(404));
});

// 에러 핸들러
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

// ✅ Vercel에선 listen 금지: export만
if (process.env.VERCEL) {
  module.exports = app;
} else {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`✅ Express 서버 실행 중: http://localhost:${port}`);
  });
}

module.exports = app;
