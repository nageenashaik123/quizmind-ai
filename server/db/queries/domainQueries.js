"use strict";

const { query } = require("../../config/db");

// ─────────────────────────────────────────────
// Domain queries
// ─────────────────────────────────────────────

/**
 * Get all domains ordered by id.
 * @returns {Promise<Array>}
 */
async function getAllDomains() {
  const result = await query(
    `SELECT id, name, description, icon
     FROM domains
     ORDER BY id ASC`
  );
  return result.rows;
}

/**
 * Get a single domain by id.
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function getDomainById(id) {
  const result = await query(
    `SELECT id, name, description, icon
     FROM domains
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

// ─────────────────────────────────────────────
// Subject queries
// ─────────────────────────────────────────────

/**
 * Get all subjects belonging to a domain.
 * @param {number} domainId
 * @returns {Promise<Array>}
 */
async function getSubjectsByDomain(domainId) {
  const result = await query(
    `SELECT id, domain_id, name, description
     FROM subjects
     WHERE domain_id = $1
     ORDER BY id ASC`,
    [domainId]
  );
  return result.rows;
}

/**
 * Get a single subject by id.
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function getSubjectById(id) {
  const result = await query(
    `SELECT s.id, s.domain_id, s.name, s.description,
            d.name AS domain_name, d.icon AS domain_icon
     FROM subjects s
     JOIN domains d ON d.id = s.domain_id
     WHERE s.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

module.exports = {
  getAllDomains,
  getDomainById,
  getSubjectsByDomain,
  getSubjectById,
};
