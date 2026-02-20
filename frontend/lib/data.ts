export type BlastRisk = "SAFE" | "LOW" | "MEDIUM" | "CRITICAL"
export type TriggerStatus = "detected" | "analyzing" | "pr_ready" | "approved" | "rejected"

export interface CodeChange {
  file: string
  language: string
  diff: string
}

export interface ReasoningStep {
  title: string
  detail: string
}

export interface Trigger {
  id: string
  resourceName: string
  resourceId: string
  service: string
  region: string
  currentInstance: string
  recommendedInstance: string
  monthlySavings: number
  yearlySavings: number
  blastRisk: BlastRisk
  status: TriggerStatus
  detectedAt: string
  aiReasoning: ReasoningStep[]
  codeChanges: CodeChange[]
  prUrl: string | null
  prTitle: string
  copilotSummary: string
}

export interface SavingsOverview {
  totalMonthlySavings: number
  totalYearlySavings: number
  totalFindings: number
  approvedCount: number
  rejectedCount: number
  pendingCount: number
  savingsHistory: { month: string; saved: number; projected: number }[]
}

// --- Mock Data ---

export const triggers: Trigger[] = [
  {
    id: "trg-001",
    resourceName: "prod-api-server-03",
    resourceId: "i-0a1b2c3d4e5f67890",
    service: "EC2",
    region: "us-east-1",
    currentInstance: "m5.4xlarge",
    recommendedInstance: "m5.xlarge",
    monthlySavings: 413,
    yearlySavings: 4956,
    blastRisk: "CRITICAL",
    status: "pr_ready",
    detectedAt: "2026-02-14T09:12:00Z",
    aiReasoning: [
      {
        title: "Low CPU utilization detected",
        detail:
          "Average CPU usage over the last 7 days is 12%, with a peak of 30%. The m5.4xlarge provides 16 vCPUs but workload rarely exceeds 4 vCPU equivalent.",
      },
      {
        title: "Memory is over-provisioned",
        detail:
          "Memory utilization averages 28% (17.9 GB of 64 GB). The recommended m5.xlarge provides 16 GB which covers peak usage with headroom.",
      },
      {
        title: "Blast radius assessment",
        detail:
          "This instance connects to recommendation-db (RDS) and prod-api-alb. Connection pool configs may need adjustment. One prior downsize attempt was rejected due to latency concerns during peak traffic.",
      },
      {
        title: "Cost-benefit analysis",
        detail:
          "Downsizing from m5.4xlarge ($0.768/hr) to m5.xlarge ($0.192/hr) saves $413/month. Risk is mitigated by the ALB health checks and auto-scaling group fallback.",
      },
    ],
    codeChanges: [
      {
        file: "modules/api-cluster/main.tf",
        language: "hcl",
        diff: `resource "aws_instance" "api_server" {
-  instance_type = "m5.4xlarge"
+  instance_type = "m5.xlarge"
   ami           = var.api_ami_id
   subnet_id     = var.private_subnet_id

   tags = {
     Name        = "prod-api-server-03"
     Environment = "production"
+    DownsizedBy = "finops-waste-hunter"
+    DownsizedAt = "2026-02-14"
   }
 }`,
      },
      {
        file: "k8s/prod/api-deployment.yaml",
        language: "yaml",
        diff: `spec:
   containers:
     - name: api
       resources:
         requests:
-          cpu: "4000m"
-          memory: "16Gi"
+          cpu: "2000m"
+          memory: "8Gi"
         limits:
-          cpu: "8000m"
-          memory: "32Gi"
+          cpu: "4000m"
+          memory: "14Gi"`,
      },
    ],
    prUrl: "https://github.com/acme-corp/infra/pull/1847",
    prTitle: "chore: downsize prod-api-server-03 from m5.4xlarge to m5.xlarge",
    copilotSummary:
      "prod-api-server-03 is running an m5.4xlarge but consistently uses less than 30% CPU and 45% memory. Downsizing to m5.xlarge saves $413/mo. Marked CRITICAL blast risk due to RDS and ALB dependencies plus one prior rejection.",
  },
  {
    id: "trg-002",
    resourceName: "batch-etl-worker-01",
    resourceId: "i-1b2c3d4e5f678901a",
    service: "EC2",
    region: "us-west-2",
    currentInstance: "c5.2xlarge",
    recommendedInstance: "c5.large",
    monthlySavings: 198,
    yearlySavings: 2376,
    blastRisk: "LOW",
    status: "pr_ready",
    detectedAt: "2026-02-15T14:30:00Z",
    aiReasoning: [
      {
        title: "Batch workload is bursty but low average",
        detail:
          "CPU averages 8% with short bursts to 20% during ETL runs. The c5.large provides sufficient compute for these bursts.",
      },
      {
        title: "No user-facing dependencies",
        detail:
          "This worker only processes SQS messages. Batch jobs may take slightly longer but remain within the 4-hour SLA window.",
      },
    ],
    codeChanges: [
      {
        file: "terraform/etl/main.tf",
        language: "hcl",
        diff: `resource "aws_instance" "etl_worker" {
-  instance_type = "c5.2xlarge"
+  instance_type = "c5.large"
   ami           = var.etl_ami_id
   
   tags = {
     Name = "batch-etl-worker-01"
+    DownsizedBy = "finops-waste-hunter"
   }
 }`,
      },
    ],
    prUrl: "https://github.com/acme-corp/infra/pull/1852",
    prTitle: "chore: downsize batch-etl-worker-01 from c5.2xlarge to c5.large",
    copilotSummary:
      "batch-etl-worker-01 is a batch processing instance running c5.2xlarge with under 20% average CPU. Downsizing to c5.large saves $198/mo with minimal risk.",
  },
  {
    id: "trg-003",
    resourceName: "staging-web-app-02",
    resourceId: "i-2c3d4e5f678901ab2",
    service: "EC2",
    region: "eu-west-1",
    currentInstance: "m5.2xlarge",
    recommendedInstance: "t3.large",
    monthlySavings: 287,
    yearlySavings: 3444,
    blastRisk: "SAFE",
    status: "pr_ready",
    detectedAt: "2026-02-16T08:00:00Z",
    aiReasoning: [
      {
        title: "Staging environment with near-zero traffic",
        detail:
          "CPU averages 5% and memory 15%. This is a staging environment with no production dependencies.",
      },
      {
        title: "Zero blast radius",
        detail: "No production services depend on this instance. Downtime during resize is acceptable for staging.",
      },
    ],
    codeChanges: [
      {
        file: "terraform/staging/main.tf",
        language: "hcl",
        diff: `resource "aws_instance" "staging_web" {
-  instance_type = "m5.2xlarge"
+  instance_type = "t3.large"
   ami           = var.web_ami_id
   
   tags = {
     Name        = "staging-web-app-02"
     Environment = "staging"
+    DownsizedBy = "finops-waste-hunter"
   }
 }`,
      },
      {
        file: "docker-compose.staging.yml",
        language: "yaml",
        diff: `services:
   web:
     deploy:
       resources:
         limits:
-          cpus: "4.0"
-          memory: 16G
+          cpus: "2.0"
+          memory: 8G`,
      },
    ],
    prUrl: "https://github.com/acme-corp/infra/pull/1855",
    prTitle: "chore: downsize staging-web-app-02 from m5.2xlarge to t3.large",
    copilotSummary:
      "staging-web-app-02 is massively over-provisioned for staging. CPU averages 8% and memory 20%. Moving to t3.large is completely safe with $287/mo in savings.",
  },
  {
    id: "trg-004",
    resourceName: "ml-training-gpu-05",
    resourceId: "i-3d4e5f678901ab2c3",
    service: "EC2",
    region: "us-east-1",
    currentInstance: "p3.8xlarge",
    recommendedInstance: "p3.2xlarge",
    monthlySavings: 892,
    yearlySavings: 10704,
    blastRisk: "MEDIUM",
    status: "analyzing",
    detectedAt: "2026-02-18T11:20:00Z",
    aiReasoning: [
      {
        title: "GPU utilization is low between training runs",
        detail:
          "GPU utilization has been under 25% for the last 7 days. The training pipeline appears to be between major runs.",
      },
      {
        title: "Training SLA needs verification",
        detail:
          "With fewer GPUs, training jobs will take longer. Need confirmation that the team can tolerate extended training times before proceeding.",
      },
    ],
    codeChanges: [],
    prUrl: null,
    prTitle: "",
    copilotSummary:
      "ml-training-gpu-05 is running p3.8xlarge but GPU utilization is under 25%. Downsizing to p3.2xlarge saves $892/mo but training SLAs need verification first. Analysis is still in progress.",
  },
  {
    id: "trg-005",
    resourceName: "cache-cluster-node-07",
    resourceId: "i-4e5f678901ab2c3d4",
    service: "ElastiCache",
    region: "us-east-1",
    currentInstance: "r5.2xlarge",
    recommendedInstance: "r5.large",
    monthlySavings: 324,
    yearlySavings: 3888,
    blastRisk: "MEDIUM",
    status: "pr_ready",
    detectedAt: "2026-02-17T06:45:00Z",
    aiReasoning: [
      {
        title: "Memory utilization is low",
        detail:
          "Cache memory utilization is 45% on an r5.2xlarge. The r5.large has sufficient memory for the current working set.",
      },
      {
        title: "Cache hit rate remains high",
        detail:
          "Hit rate is 99.2%, indicating the hot data fits well within a smaller memory footprint. Eviction rate is near zero.",
      },
      {
        title: "Session store dependency",
        detail:
          "This node serves as a session store for the API gateway. Session eviction rate may increase slightly but is within acceptable parameters.",
      },
    ],
    codeChanges: [
      {
        file: "modules/cache-cluster/main.tf",
        language: "hcl",
        diff: `resource "aws_elasticache_replication_group" "cache" {
-  node_type = "cache.r5.2xlarge"
+  node_type = "cache.r5.large"
   
   parameter_group_name = aws_elasticache_parameter_group.cache.name
   
   tags = {
     Name = "cache-cluster-node-07"
+    DownsizedBy = "finops-waste-hunter"
   }
 }`,
      },
    ],
    prUrl: "https://github.com/acme-corp/infra/pull/1850",
    prTitle: "chore: downsize cache-cluster-node-07 from r5.2xlarge to r5.large",
    copilotSummary:
      "cache-cluster-node-07 memory utilization is only 45% with a 99.2% hit rate. Downsizing to r5.large saves $324/mo with manageable session eviction risk.",
  },
  {
    id: "trg-006",
    resourceName: "log-aggregator-prod",
    resourceId: "i-5f678901ab2c3d4e5",
    service: "EC2",
    region: "eu-central-1",
    currentInstance: "m5.xlarge",
    recommendedInstance: "t3.medium",
    monthlySavings: 112,
    yearlySavings: 1344,
    blastRisk: "SAFE",
    status: "approved",
    detectedAt: "2026-02-13T15:00:00Z",
    aiReasoning: [
      {
        title: "Non-critical logging workload",
        detail:
          "CPU averages 6% and memory 18%. Log aggregation is asynchronous and tolerates brief interruptions.",
      },
      {
        title: "No production dependencies",
        detail: "Logs are buffered in a Kinesis stream upstream. Brief downtime during resize causes no data loss.",
      },
    ],
    codeChanges: [
      {
        file: "terraform/logging/main.tf",
        language: "hcl",
        diff: `resource "aws_instance" "log_aggregator" {
-  instance_type = "m5.xlarge"
+  instance_type = "t3.medium"
   ami           = var.log_ami_id
   
   tags = {
     Name = "log-aggregator-prod"
+    DownsizedBy = "finops-waste-hunter"
   }
 }`,
      },
    ],
    prUrl: "https://github.com/acme-corp/infra/pull/1843",
    prTitle: "chore: downsize log-aggregator-prod from m5.xlarge to t3.medium",
    copilotSummary:
      "log-aggregator-prod runs at very low utilization (8% CPU, 22% memory). Safe to downsize to t3.medium saving $112/mo. Already approved and merged.",
  },
]

export function getTriggerById(id: string): Trigger | undefined {
  return triggers.find((t) => t.id === id)
}

export function getSavingsOverview(): SavingsOverview {
  const approved = triggers.filter((t) => t.status === "approved")
  const rejected = triggers.filter((t) => t.status === "rejected")
  const pending = triggers.filter(
    (t) => t.status !== "approved" && t.status !== "rejected"
  )

  return {
    totalMonthlySavings: triggers.reduce((s, t) => s + t.monthlySavings, 0),
    totalYearlySavings: triggers.reduce((s, t) => s + t.yearlySavings, 0),
    totalFindings: triggers.length,
    approvedCount: approved.length,
    rejectedCount: rejected.length,
    pendingCount: pending.length,
    savingsHistory: [
      { month: "Sep", saved: 320, projected: 1800 },
      { month: "Oct", saved: 580, projected: 1950 },
      { month: "Nov", saved: 870, projected: 2100 },
      { month: "Dec", saved: 1240, projected: 2200 },
      { month: "Jan", saved: 1650, projected: 2226 },
      { month: "Feb", saved: 2114, projected: 2226 },
    ],
  }
}
