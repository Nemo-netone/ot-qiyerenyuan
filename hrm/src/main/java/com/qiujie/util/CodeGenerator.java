package com.qiujie.util;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.generator.AutoGenerator;
import com.baomidou.mybatisplus.generator.config.DataSourceConfig;
import com.baomidou.mybatisplus.generator.config.GlobalConfig;
import com.baomidou.mybatisplus.generator.config.OutputFile;
import com.baomidou.mybatisplus.generator.config.PackageConfig;
import com.baomidou.mybatisplus.generator.config.StrategyConfig;
import com.baomidou.mybatisplus.generator.config.converts.MySqlTypeConvert;
import com.baomidou.mybatisplus.generator.config.rules.DateType;

import java.util.Collections;

public class CodeGenerator {
    public static void main(String[] args) {
        String dbUrl = System.getenv().getOrDefault("HRM_GENERATOR_DB_URL",
                "jdbc:mysql://localhost:3306/hrm?useUnicode=true&characterEncoding=utf8&serverTimezone=GMT%2b8");
        String dbUsername = System.getenv().getOrDefault("HRM_GENERATOR_DB_USERNAME", "root");
        String dbPassword = System.getenv().getOrDefault("HRM_GENERATOR_DB_PASSWORD", "");
        String outputDir = System.getenv().getOrDefault("HRM_GENERATOR_OUTPUT_DIR", "generated/java");
        String mapperXmlDir = System.getenv().getOrDefault("HRM_GENERATOR_MAPPER_XML_DIR", "generated/mapper");

        DataSourceConfig dataSourceConfig = new DataSourceConfig
                .Builder(dbUrl, dbUsername, dbPassword)
                .typeConvert(new MySqlTypeConvert())
                .build();

        GlobalConfig globalConfig = new GlobalConfig.Builder()
                .fileOverride()
                .outputDir(outputDir)
                .author("qiujie")
                .enableSwagger()
                .dateType(DateType.SQL_PACK)
                .commentDate("yyyy-MM-dd")
                .build();

        PackageConfig packageConfig = new PackageConfig.Builder()
                .parent("com.hrm")
                .entity("entity")
                .service("service")
                .serviceImpl("service.impl")
                .mapper("mapper")
                .controller("controller")
                .pathInfo(Collections.singletonMap(OutputFile.mapperXml, mapperXmlDir))
                .build();

        StrategyConfig strategyConfig = new StrategyConfig.Builder()
                .addTablePrefix("sys_", "per_", "soc_", "sal_", "att_", "act_re_")
                .addInclude("sal_salary")
                .entityBuilder()
                .enableLombok()
                .enableTableFieldAnnotation()
                .logicDeleteColumnName("is_deleted")
                .idType(IdType.AUTO)
                .enableChainModel()
                .mapperBuilder()
                .superClass(BaseMapper.class)
                .serviceBuilder()
                .formatServiceFileName("%sService")
                .controllerBuilder()
                .enableRestStyle()
                .enableHyphenStyle()
                .build();

        new AutoGenerator(dataSourceConfig)
                .global(globalConfig)
                .packageInfo(packageConfig)
                .strategy(strategyConfig)
                .execute();
    }
}
