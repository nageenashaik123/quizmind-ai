"use strict";

const {
  getAllDomains,
  getDomainById,
  getSubjectsByDomain,
} = require("../db/queries/domainQueries");

// ─────────────────────────────────────────────
// GET /api/domains
// Returns all 4 domains.
// Public — no authentication required.
// ─────────────────────────────────────────────
async function listDomains(req, res, next) {
  try {
    const domains = await getAllDomains();

    return res.status(200).json({
      success: true,
      data: domains,
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────
// GET /api/domains/:id/subjects
// Returns all subjects belonging to a domain.
// Public — no authentication required.
// ─────────────────────────────────────────────
async function listSubjects(req, res, next) {
  try {
    const domainId = parseInt(req.params.id, 10);

    // Validate that :id is a positive integer
    if (isNaN(domainId) || domainId < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid domain ID.",
      });
    }

    // Confirm the domain actually exists
    const domain = await getDomainById(domainId);
    if (!domain) {
      return res.status(404).json({
        success: false,
        message: "Domain not found.",
      });
    }

    const subjects = await getSubjectsByDomain(domainId);

    return res.status(200).json({
      success: true,
      data: {
        domain,
        subjects,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listDomains, listSubjects };
