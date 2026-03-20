//! Extended identifier types: UPC/EAN, IPI/CAE, ISWC, BOWI.
use serde::{Deserialize, Serialize};
use crate::types::{Bowi, ParseError};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct Upc(pub String);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct Ipi(pub String);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct Iswc(pub String);

#[derive(Debug, Clone, PartialEq)]
pub enum IdentifierError {
    InvalidFormat(String),
    InvalidCheckDigit,
    WrongLength { expected: usize, got: usize },
}

impl std::fmt::Display for IdentifierError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidFormat(s) => write!(f, "invalid format: {}", s),
            Self::InvalidCheckDigit => write!(f, "check digit mismatch"),
            Self::WrongLength{expected,got} => write!(f, "expected {} digits, got {}", expected, got),
        }
    }
}

fn validate_gs1_check(digits: &str) -> bool {
    let d: Vec<u32> = digits.chars().filter_map(|c| c.to_digit(10)).collect();
    if d.len() < 2 { return false; }
    let payload = &d[..d.len()-1];
    let check   = *d.last().unwrap();
    let sum: u32 = payload.iter().enumerate().map(|(i, &v)| {
        if (payload.len() - i) % 2 == 1 { v * 3 } else { v }
    }).sum();
    (10 - (sum % 10)) % 10 == check
}

pub fn recognize_upc(input: &str) -> Result<Upc, IdentifierError> {
    let digits: String = input.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() != 12 && digits.len() != 13 {
        return Err(IdentifierError::WrongLength { expected: 13, got: digits.len() });
    }
    if !validate_gs1_check(&digits) { return Err(IdentifierError::InvalidCheckDigit); }
    Ok(Upc(digits))
}

pub fn recognize_ipi(input: &str) -> Result<Ipi, IdentifierError> {
    let digits: String = input.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() != 11 {
        return Err(IdentifierError::WrongLength { expected: 11, got: digits.len() });
    }
    Ok(Ipi(digits))
}

pub fn recognize_iswc(input: &str) -> Result<Iswc, IdentifierError> {
    let s = input.trim().to_uppercase();
    let digits: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
    if !s.starts_with('T') {
        return Err(IdentifierError::InvalidFormat("must start with T".into()));
    }
    if digits.len() != 10 {
        return Err(IdentifierError::WrongLength { expected: 10, got: digits.len() });
    }
    let d: Vec<u32> = digits.chars().filter_map(|c| c.to_digit(10)).collect();
    let sum: u32 = d.iter().enumerate().map(|(i, &v)| v * (i as u32 + 1)).sum();
    if sum % 10 != 0 { return Err(IdentifierError::InvalidCheckDigit); }
    Ok(Iswc(format!("T-{}-{}", &digits[..9], &digits[9..])))
}

// ── BOWI: bowi:{uuid4} ──────────────────────────────────────────────────────
// Accepts "bowi:{uuid4}" or bare "{uuid4}". Validates RFC 4122 v4 structure.
pub fn recognize_bowi(input: &str) -> Result<Bowi, ParseError> {
    let s = input.trim();
    let uuid = if s.starts_with("bowi:") { &s[5..] } else { s };
    if validate_uuid4(uuid) {
        Ok(Bowi(format!("bowi:{}", uuid.to_lowercase())))
    } else {
        Err(ParseError::InvalidBowi(input.to_string()))
    }
}

fn validate_uuid4(u: &str) -> bool {
    let b = u.as_bytes();
    if u.len() != 36 { return false; }
    if b[8]!=b'-'||b[13]!=b'-'||b[18]!=b'-'||b[23]!=b'-' { return false; }
    if b[14] != b'4' { return false; }
    if !matches!(b[19], b'8'|b'9'|b'a'|b'b'|b'A'|b'B') { return false; }
    for (i,&c) in b.iter().enumerate() {
        if i==8||i==13||i==18||i==23 { continue; }
        if !(c as char).is_ascii_hexdigit() { return false; }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn valid_iswc_all_zero() {
        assert!(recognize_iswc("T-000000000-0").is_ok());
    }
    #[test]
    fn invalid_check_rejected() {
        assert_eq!(recognize_iswc("T-000000000-1"), Err(IdentifierError::InvalidCheckDigit));
    }
}
