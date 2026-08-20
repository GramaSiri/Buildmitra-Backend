const express = require("express");
const { spawn } = require("child_process");
const path = require("path");

const router = express.Router();


router.post("/solve", async (req, res) => {

  const payload = req.body || {};

  if (
    !payload.input ||
    !payload.envelope ||
    !Array.isArray(payload.programme)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid DRG V2 solver request."
    });
  }


  const python =
    process.env.PYTHON_BIN ||
    process.env.PYTHON ||
    "python";


  const solverPath =
    path.join(
      __dirname,
      "..",
      "drg_solver",
      "solver.py"
    );


  const child =
    spawn(
      python,
      [solverPath],
      {
        stdio: [
          "pipe",
          "pipe",
          "pipe"
        ]
      }
    );


  let stdout = "";
  let stderr = "";


  const timeout =
    setTimeout(() => {

      try {
        child.kill();
      } catch {}

    }, 20000);


  child.stdout.on(
    "data",
    chunk => {
      stdout += chunk.toString();
    }
  );


  child.stderr.on(
    "data",
    chunk => {
      stderr += chunk.toString();
    }
  );


  child.on(
    "error",
    error => {

      clearTimeout(timeout);

      console.error(
        "DRG V2 solver process error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Could not start DRG solver.",
        error: error.message
      });
    }
  );


  child.on(
    "close",
    code => {

      clearTimeout(timeout);

      let data = null;

      try {
        data =
          JSON.parse(
            String(stdout || "").trim()
          );
      }
      catch (error) {

        console.error(
          "DRG V2 invalid solver output:",
          stdout,
          stderr
        );

        return res.status(500).json({
          success: false,
          message:
            "DRG solver returned invalid output.",
          error:
            stderr ||
            error.message
        });
      }


      if (code !== 0) {

        console.error(
          "DRG V2 solver failed:",
          stderr
        );

        return res.status(500).json({
          success: false,
          message:
            "DRG solver process failed.",
          error:
            stderr,
          solver:
            data
        });
      }


      return res.json(data);
    }
  );


  child.stdin.write(
    JSON.stringify(payload)
  );

  child.stdin.end();
});


module.exports = router;
