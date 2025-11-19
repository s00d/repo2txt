use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "options")]
pub enum SettingType {
    Text,
    Number {
        min: Option<u64>,
        max: Option<u64>,
        suffix: Option<String>,
    },
    Select {
        options: Vec<String>,
    },
    Tags,
    Textarea {
        rows: u8,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingField {
    pub key: String,
    pub label: String,
    pub description: Option<String>,
    pub component: SettingType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingSection {
    pub id: String,
    pub label: String,
    pub fields: Vec<SettingField>,
}

pub fn get_app_settings_schema() -> Vec<SettingSection> {
    vec![
        SettingSection {
            id: "general".to_string(),
            label: "General".to_string(),
            fields: vec![
                SettingField {
                    key: "theme".to_string(),
                    label: "Interface Theme".to_string(),
                    description: Some("Choose your preferred color scheme.".to_string()),
                    component: SettingType::Select {
                        options: vec!["system".to_string(), "light".to_string(), "dark".to_string()],
                    },
                },
                SettingField {
                    key: "token_limit".to_string(),
                    label: "Token Limit Warning".to_string(),
                    description: Some("Progress bar turns red when this limit is exceeded.".to_string()),
                    component: SettingType::Number {
                        min: Some(1000),
                        max: None,
                        suffix: Some("tokens".to_string()),
                    },
                },
            ],
        },
        SettingSection {
            id: "generation".to_string(),
            label: "Generation".to_string(),
            fields: vec![
                SettingField {
                    key: "output_filename".to_string(),
                    label: "Default Output Filename".to_string(),
                    description: None,
                    component: SettingType::Text,
                },
                SettingField {
                    key: "max_file_size".to_string(),
                    label: "Max File Size".to_string(),
                    description: Some("Files larger than this will be skipped.".to_string()),
                    component: SettingType::Number {
                        min: Some(1024),
                        max: None,
                        suffix: Some("bytes".to_string()),
                    },
                },
                SettingField {
                    key: "output_template".to_string(),
                    label: "Output Template".to_string(),
                    description: Some("Variables: {{path}}, {{language}}, {{content}}".to_string()),
                    component: SettingType::Textarea { rows: 6 },
                },
            ],
        },
        SettingSection {
            id: "filters".to_string(),
            label: "Filters".to_string(),
            fields: vec![
                SettingField {
                    key: "ignored_names".to_string(),
                    label: "Ignored Files & Folders".to_string(),
                    description: Some("Exact match for files and folders to skip.".to_string()),
                    component: SettingType::Tags,
                },
                SettingField {
                    key: "binary_extensions".to_string(),
                    label: "Binary Extensions".to_string(),
                    description: Some("Files with these extensions will be skipped.".to_string()),
                    component: SettingType::Tags,
                },
            ],
        },
    ]
}

