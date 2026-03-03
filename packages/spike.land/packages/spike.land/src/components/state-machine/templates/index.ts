/**
 * State Machine Templates - Barrel Export
 *
 * Re-exports all template categories and the combined TEMPLATES array.
 */

import type { TemplateCategory, TemplateDefinition } from "../TemplateLibrary";
import { BASICS_TEMPLATES, WEB_API_TEMPLATES } from "./basics-web";
import {
  ECOMMERCE_TEMPLATES,
  GAMING_TEMPLATES,
  IOT_HARDWARE_TEMPLATES,
} from "./commerce-iot-gaming";
import {
  COMMUNICATION_TEMPLATES,
  DEVOPS_TEMPLATES,
  HEALTHCARE_TEMPLATES,
} from "./devops-healthcare-communication";
import {
  EMBEDDED_TEMPLATES,
  FINANCE_TEMPLATES,
  WORKFLOW_TEMPLATES,
} from "./workflow-finance-embedded";

export const CATEGORIES: TemplateCategory[] = [
  "All",
  "Basics",
  "Web & API",
  "E-Commerce",
  "IoT & Hardware",
  "Gaming",
  "DevOps & CI/CD",
  "Healthcare",
  "Communication",
  "Workflow",
  "Finance",
  "Embedded",
];

export const TEMPLATES: TemplateDefinition[] = [
  ...BASICS_TEMPLATES,
  ...WEB_API_TEMPLATES,
  ...ECOMMERCE_TEMPLATES,
  ...IOT_HARDWARE_TEMPLATES,
  ...GAMING_TEMPLATES,
  ...DEVOPS_TEMPLATES,
  ...HEALTHCARE_TEMPLATES,
  ...COMMUNICATION_TEMPLATES,
  ...WORKFLOW_TEMPLATES,
  ...FINANCE_TEMPLATES,
  ...EMBEDDED_TEMPLATES,
];

export {
  BASICS_TEMPLATES,
  COMMUNICATION_TEMPLATES,
  DEVOPS_TEMPLATES,
  ECOMMERCE_TEMPLATES,
  EMBEDDED_TEMPLATES,
  FINANCE_TEMPLATES,
  GAMING_TEMPLATES,
  HEALTHCARE_TEMPLATES,
  IOT_HARDWARE_TEMPLATES,
  WEB_API_TEMPLATES,
  WORKFLOW_TEMPLATES,
};
