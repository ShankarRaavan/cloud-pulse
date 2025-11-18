// services/aws-service-js/src/controllers/credentialsController.js
const { EC2Client, DescribeRegionsCommand } = require("@aws-sdk/client-ec2");

exports.getAwsRegions = async (req, res) => {
  try {
    const ec2 = new EC2Client({ region: "us-east-1" });
    const resp = await ec2.send(new DescribeRegionsCommand({}));
    const regions = (resp.Regions || []).map(r => r.RegionName);
    // Fallback if API blocked:
    if (!regions.length) throw new Error("No regions returned");
    res.json(regions);
  } catch {
    res.json([
      "us-east-1","us-east-2","us-west-1","us-west-2","af-south-1","ap-east-1","ap-south-1","ap-south-2",
      "ap-southeast-1","ap-southeast-2","ap-southeast-3","ap-northeast-1","ap-northeast-2","ap-northeast-3",
      "ca-central-1","eu-central-1","eu-central-2","eu-west-1","eu-west-2","eu-west-3",
      "eu-south-1","eu-south-2","eu-north-1","me-south-1","me-central-1","sa-east-1"
    ]);
  }
};


