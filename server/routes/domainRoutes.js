"use strict";

const express = require("express");
const router  = express.Router();
const { listDomains, listSubjects } = require("../controllers/domainController");

// GET /api/domains
// Returns all domains
router.get("/", listDomains);

// GET /api/domains/:id/subjects
// Returns the domain + its subjects
router.get("/:id/subjects", listSubjects);

module.exports = router;
