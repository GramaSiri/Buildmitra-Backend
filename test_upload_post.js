const http = require("http");
const fs = require("fs");
const path = require("path");

function testPost(pathName) {
  const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
  const postData = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="images"; filename="test.jpg"',
    "Content-Type: image/jpeg",
    "",
    "fake image content",
    `--${boundary}--`
  ].join("\r\n");

  const req = http.request({
    hostname: "localhost",
    port: 5000,
    path: pathName,
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": Buffer.byteLength(postData),
    },
  }, (res) => {
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      console.log(`PATH ${pathName} -> Status: ${res.statusCode}, Body: ${body}`);
    });
  });

  req.on("error", (e) => console.error(`Error testing ${pathName}:`, e.message));
  req.write(postData);
  req.end();
}

testPost("/api/realestate/upload-images");
testPost("/api/realestate/upload-files");
testPost("/api/realestate");
testPost("/api/realestate/public");
