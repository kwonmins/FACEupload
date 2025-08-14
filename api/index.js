const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const upload = multer({ dest: "/tmp" }); // Vercel 서버리스 환경에서는 /tmp만 사용 가능

app.set("views", path.join(__dirname, "../views"));
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// 홈 페이지 렌더링
app.get("/", (req, res) => {
  res.render("index");
});

// 업로드 및 Colab 서버 호출
app.post(
  "/upload",
  upload.fields([
    { name: "user" },
    { name: "style" },
    { name: "color" },
  ]),
  async (req, res) => {
    try {

       console.log("파일들:", req.files); // ✅ 로그 찍기
      const userPath = req.files["user"]?.[0]?.path;
      const stylePath = req.files["style"]?.[0]?.path;
      const colorPath = req.files["color"]?.[0]?.path;

      if (!userPath || !stylePath || !colorPath) {
        throw new Error("파일 누락");
      }

      const form = new FormData();
      form.append("user", fs.createReadStream(userPath));
      form.append("style", fs.createReadStream(stylePath));
      form.append("color", fs.createReadStream(colorPath));

      const response = await axios.post(
        "https://703d-35-227-18-11.ngrok-free.app/generate",
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
      console.error("❌ 처리 실패:", err);
      res.status(500).send("서버 오류");
    }
  }
);

module.exports = app;
