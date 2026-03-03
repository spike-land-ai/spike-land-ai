import { EC2Client } from "@aws-sdk/client-ec2";

declare global {
  var __ec2Client: EC2Client | undefined;
}

function getEC2Region(): string {
  return process.env.BOX_EC2_REGION || "eu-west-2";
}

export function getEC2Client(): EC2Client {
  if (process.env.NODE_ENV === "development") {
    return new EC2Client({ region: getEC2Region() });
  }

  if (!global.__ec2Client) {
    global.__ec2Client = new EC2Client({ region: getEC2Region() });
  }
  return global.__ec2Client;
}

export function getEC2Config() {
  const region = getEC2Region();
  const amiId = process.env.BOX_EC2_AMI_ID;
  const instanceType = process.env.BOX_EC2_INSTANCE_TYPE || "t4g.small";
  const keyName = process.env.BOX_EC2_KEY_NAME;
  const securityGroupId = process.env.BOX_EC2_SECURITY_GROUP_ID;
  const subnetId = process.env.BOX_EC2_SUBNET_ID;

  if (!amiId || !securityGroupId || !subnetId) {
    throw new Error(
      "EC2 provisioning requires BOX_EC2_AMI_ID, BOX_EC2_SECURITY_GROUP_ID, and BOX_EC2_SUBNET_ID",
    );
  }

  return { region, amiId, instanceType, keyName, securityGroupId, subnetId };
}
