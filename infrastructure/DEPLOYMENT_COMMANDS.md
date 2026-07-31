# E-Commerce Infrastructure Deployment Guide

This document contains all the commands you need to package your microservices, deploy the infrastructure to AWS, and securely tear it down when you are finished.

All commands below should be run from a **PowerShell** terminal.

## 1. Prerequisites (Run Once)
Since you are on Windows, you need to allow PowerShell to execute scripts (like `npm`) locally so the packaging script can run.

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

## 2. Package the Microservices
Before deploying to AWS, you must package the 10 microservices into `.zip` files. Navigate to the root folder of your project (where `package-lambdas.js` is located) and run:

```powershell
node package-lambdas.js
```
*Wait for this command to print "Successfully packaged" for all services before continuing.*

## 3. Authenticate with AWS Academy
Open your AWS Academy Learner Lab, click **AWS Details**, click **Show** next to AWS CLI, and copy the PowerShell block. Paste it into your terminal:

```powershell
# Example (Replace with your actual values from the lab!)
$env:AWS_ACCESS_KEY_ID="ASIA..."
$env:AWS_SECRET_ACCESS_KEY="wJal..."
$env:AWS_SESSION_TOKEN="IQoJb3..."
```

## 4. Deploy the Infrastructure
Navigate into the `infrastructure` directory and use Terraform to deploy everything. 

```powershell
cd infrastructure

# Initialize Terraform (downloads AWS provider plugins)
terraform init

# Deploy the infrastructure
terraform apply -var="lab_role_arn=arn:aws:iam::YOUR_ACCOUNT_ID:role/LabRole"
```
*(Make sure to replace `YOUR_ACCOUNT_ID` with your actual 12-digit AWS Account ID from the Learner Lab! Terraform will prompt you to type `yes` to confirm the deployment).*


## 5. Teardown / Cleanup
To avoid using up your AWS Academy credits, you can instantly tear down the entire infrastructure when you are done testing. Run this from the `infrastructure` folder:

```powershell
terraform destroy -var="lab_role_arn=arn:aws:iam::YOUR_ACCOUNT_ID:role/LabRole"
```
*(Terraform will calculate everything to destroy and prompt you to type `yes` to confirm).*
