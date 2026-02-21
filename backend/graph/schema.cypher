// ============================================================================
// Minimalist — Neo4j Knowledge Graph Schema
// Run this file once to seed the graph for the hackathon demo.
//
// Usage (neo4j-shell or Aura Query console):
//   :source schema.cypher
//
// Graph represents: AWS us-east-1 prod environment
//   EC2 prod-api-server-03 (our waste target)
//   ↓ CONNECTS_TO port 5432
//   RDS recommendation-db  (critical dependency!)
//   ALB lb-prod-api → ROUTES_TO → EC2
//   SecurityGroup → SECURED_BY → EC2
// ============================================================================

// ── 0. Wipe existing demo data ───────────────────────────────────────────────
MATCH (n) DETACH DELETE n;


// ── 1. Create Nodes ──────────────────────────────────────────────────────────

// EC2 instance (our waste target)
CREATE (:EC2 {
  id:            "i-0a1b2c3d4e5f67890",
  name:          "prod-api-server-03",
  instance_type: "m5.4xlarge",
  environment:   "production",
  region:        "us-east-1",
  team:          "platform",
  service:       "recommendation-engine",
  criticality:   "MEDIUM"
});

// RDS PostgreSQL — connected DB (CRITICAL)
CREATE (:RDS {
  id:          "recommendation-db",
  name:        "recommendation-db",
  engine:      "postgres",
  version:     "15.4",
  instance:    "db.t3.medium",
  environment: "production",
  criticality: "HIGH",
  has_backups: true
});

// Application Load Balancer
CREATE (:LoadBalancer {
  id:          "lb-prod-api",
  name:        "prod-api-alb",
  type:        "ALB",
  environment: "production",
  criticality: "HIGH",
  dns_name:    "prod-api-alb-123456.us-east-1.elb.amazonaws.com"
});

// Security Group
CREATE (:SecurityGroup {
  id:          "sg-0a1b2c3d4e5f67891",
  name:        "prod-api-server-03-sg",
  description: "HTTP/HTTPS inbound from internal, all outbound",
  environment: "production"
});

// VPC
CREATE (:VPC {
  id:          "vpc-0a1b2c3d",
  name:        "prod-vpc",
  cidr:        "10.0.0.0/16",
  environment: "production"
});

// Subnet
CREATE (:Subnet {
  id:           "subnet-0a1b2c3d",
  name:         "prod-private-subnet-1a",
  cidr:         "10.0.1.0/24",
  az:           "us-east-1a",
  environment:  "production"
});

// Lambda function that also reads from the same RDS (shared dependency)
CREATE (:Lambda {
  id:          "lambda-recommendation-refresh",
  name:        "recommendation-refresh",
  runtime:     "python3.12",
  environment: "production",
  criticality: "MEDIUM"
});

// S3 Bucket (ML model artifacts read by the EC2 service)
CREATE (:S3Bucket {
  id:          "s3-recommendation-models",
  name:        "company-recommendation-models",
  environment: "production",
  criticality: "LOW"
});

// Past rejected PR (agent long-term memory — Phase 2 feature)
CREATE (:RejectedAction {
  id:          "pr-rejected-001",
  resource_id: "i-0a1b2c3d4e5f67890",
  action:      "DOWNSIZE",
  from_type:   "m5.4xlarge",
  to_type:     "m5.xlarge",
  rejected_by: "alice@company.com",
  reason:      "Black Friday traffic spike incoming — revisit in January",
  rejected_at: datetime("2024-11-15T10:30:00Z"),
  status:      "REJECTED"
});


// ── 2. Create Relationships ──────────────────────────────────────────────────

// EC2 → RDS  (critical: downsizing EC2 must not break DB connectivity)
MATCH (ec2:EC2 {id: "i-0a1b2c3d4e5f67890"}),
      (rds:RDS {id: "recommendation-db"})
CREATE (ec2)-[:CONNECTS_TO {
  port:     5432,
  protocol: "tcp",
  label:    "PostgreSQL client"
}]->(rds);

// ALB → EC2  (traffic ingress — EC2 is behind this ALB)
MATCH (lb:LoadBalancer {id: "lb-prod-api"}),
      (ec2:EC2 {id: "i-0a1b2c3d4e5f67890"})
CREATE (lb)-[:ROUTES_TO {
  port:     8080,
  protocol: "HTTP",
  weight:   100
}]->(ec2);

// EC2 secured by SG
MATCH (ec2:EC2 {id: "i-0a1b2c3d4e5f67890"}),
      (sg:SecurityGroup {id: "sg-0a1b2c3d4e5f67891"})
CREATE (ec2)-[:SECURED_BY]->(sg);

// EC2 lives in Subnet → VPC
MATCH (ec2:EC2 {id: "i-0a1b2c3d4e5f67890"}),
      (sn:Subnet {id: "subnet-0a1b2c3d"})
CREATE (ec2)-[:BELONGS_TO]->(sn);

MATCH (sn:Subnet {id: "subnet-0a1b2c3d"}),
      (vpc:VPC {id: "vpc-0a1b2c3d"})
CREATE (sn)-[:BELONGS_TO]->(vpc);

// Lambda ALSO connects to same RDS (shared dependency — blast radius risk)
MATCH (lam:Lambda {id: "lambda-recommendation-refresh"}),
      (rds:RDS {id: "recommendation-db"})
CREATE (lam)-[:CONNECTS_TO {
  port:     5432,
  protocol: "tcp",
  label:    "nightly refresh job"
}]->(rds);

// EC2 reads from S3
MATCH (ec2:EC2 {id: "i-0a1b2c3d4e5f67890"}),
      (s3:S3Bucket {id: "s3-recommendation-models"})
CREATE (ec2)-[:READS_FROM {
  access: "GetObject",
  frequency: "on-startup"
}]->(s3);

// Link rejected action to EC2 (long-term agent memory)
MATCH (ec2:EC2 {id: "i-0a1b2c3d4e5f67890"}),
      (ra:RejectedAction {id: "pr-rejected-001"})
CREATE (ec2)-[:HAS_REJECTED_ACTION]->(ra);


// ── 3. Verify seed ───────────────────────────────────────────────────────────
MATCH (n) RETURN labels(n) AS type, count(n) AS count ORDER BY count DESC;
